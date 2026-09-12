import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../prisma.service';
import { BillingEventsProducer } from '../events/billing-events.producer';

/**
 * T124/ADR-009: Stripe subscriptions auto-renew and can fail/cancel with no new
 * request from our client, so `Subscription` rows are also kept in sync here, not
 * only at initial creation (subscriptions.service.ts). Requires the raw request body
 * (see main.ts's `rawBody: true`) — the signature is over the exact bytes Stripe sent,
 * not a re-serialization of the parsed JSON.
 */
@Controller('payment-webhook')
export class StripeWebhookController {
  private stripeClient: Stripe | undefined;

  // Lazy: constructing eagerly threw at service boot whenever STRIPE_SECRET_KEY is
  // unset (Stripe's constructor rejects an empty apiKey) — confirmed live, since
  // PAYMENT_PROVIDER defaults away from Stripe locally but this controller is always
  // registered. Deferred to first webhook call, which the try/catch below already
  // turns into a 400 rather than crashing DI container instantiation.
  private get stripe(): Stripe {
    if (!this.stripeClient) {
      this.stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
    }
    return this.stripeClient;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: BillingEventsProducer,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody as Buffer,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET ?? '',
      );
    } catch {
      // Never leak why verification failed (bad secret vs. tampered payload vs. missing header).
      throw new BadRequestException();
    }

    switch (event.type) {
      case 'customer.subscription.updated':
        await this.syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.syncSubscription(event.data.object as Stripe.Subscription, 'expired');
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break; // Every other event type is outside this task's scope.
    }

    return { received: true };
  }

  private async syncSubscription(stripeSub: Stripe.Subscription, forcedStatus?: 'expired') {
    const row = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });
    if (!row) return; // Unknown to us (e.g. a subscription never created through this API) — nothing to sync.

    const status = forcedStatus ?? mapStripeStatus(stripeSub);
    await this.applyStatusChange(row.id, status);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    // Recent API versions moved this out of a top-level `subscription` field.
    const subDetails = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof subDetails === 'string' ? subDetails : subDetails?.id;
    if (!subscriptionId) return;

    const row = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!row) return;

    await this.applyStatusChange(row.id, 'payment_failed');
  }

  private async applyStatusChange(subscriptionRowId: string, status: string) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscriptionRowId },
        data: { status: status as never },
      });
      // Same event, same shape, as a user-initiated change (subscriptions.service.ts) —
      // downstream consumers (Notification) shouldn't need to care about the source.
      await this.events.subscriptionChanged(
        tx as unknown as PrismaService,
        {
          userId: updated.userId,
          subscriptionId: updated.id,
          plan: updated.plan,
          status: updated.status,
          currentPeriodEnd: updated.currentPeriodEnd,
        },
        `stripe-webhook-${subscriptionRowId}`,
      );
    });
  }
}

function mapStripeStatus(stripeSub: Stripe.Subscription): string {
  if (stripeSub.cancel_at_period_end) return 'cancelled_pending_period_end';
  if (stripeSub.status === 'canceled') return 'expired';
  if (stripeSub.status === 'past_due' || stripeSub.status === 'unpaid') return 'payment_failed';
  return 'active';
}
