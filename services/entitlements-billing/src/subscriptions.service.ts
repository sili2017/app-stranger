import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from './prisma.service';
import { BillingEventsProducer } from './events/billing-events.producer';
import { createPaymentVerifier } from './payment-webhook/payment-provider-factory';
import {
  discountedPriceMinor,
  periodLengthMs,
  REFERENCE_CURRENCY,
  SUBSCRIPTION_BASE_PRICE_MINOR,
} from './pricing';

@Injectable()
export class SubscriptionsService {
  private readonly verifier = createPaymentVerifier();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: BillingEventsProducer,
  ) {}

  /** T103: creates an auto-renewing subscription (FR-032). */
  async create(
    userId: string,
    plan: 'weekly' | 'monthly' | 'yearly',
    receiptToken: string,
    correlationId: string,
    // T124/ADR-009: Stripe's own subscription id (from the Checkout Session the client
    // completed), so the webhook can later match customer.subscription.* events back
    // to this row. Undefined for the mock provider, which never gets webhook callbacks.
    stripeSubscriptionId?: string,
  ) {
    const verification = await this.verifier.verifyReceipt(receiptToken);
    if (!verification.valid) {
      throw new DomainError(
        'PAYMENT_VERIFICATION_FAILED',
        'errors.paymentVerificationFailed',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const currentPeriodEnd = new Date(Date.now() + periodLengthMs(plan));
    const subscription = await this.prisma.$transaction(async (tx) => {
      const row = await tx.subscription.create({
        data: {
          userId,
          plan,
          status: 'active',
          currentPeriodEnd,
          basePriceMinor: SUBSCRIPTION_BASE_PRICE_MINOR[plan],
          discountPct: plan === 'monthly' ? 10 : plan === 'yearly' ? 20 : 0,
          currency: REFERENCE_CURRENCY,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
        },
      });
      await this.events.subscriptionChanged(
        tx as unknown as PrismaService,
        {
          userId,
          subscriptionId: row.id,
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
        },
        correlationId,
      );
      return row;
    });

    return { ...subscription, discountedPriceMinor: discountedPriceMinor(plan) };
  }

  /**
   * T103: cancellation takes effect at currentPeriodEnd — entitlement continues until
   * then, no refund for the remaining period (FR-032, resolved).
   */
  async cancel(userId: string, subscriptionId: string, correlationId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription || subscription.userId !== userId) {
      throw new DomainError(
        'SUBSCRIPTION_NOT_FOUND',
        'errors.subscriptionNotFound',
        HttpStatus.NOT_FOUND,
      );
    }
    if (subscription.status !== 'active') {
      throw new DomainError(
        'SUBSCRIPTION_NOT_CANCELLABLE',
        'errors.subscriptionNotCancellable',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'cancelled_pending_period_end' },
      });
      await this.events.subscriptionChanged(
        tx as unknown as PrismaService,
        {
          userId,
          subscriptionId: row.id,
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
        },
        correlationId,
      );
      return row;
    });

    return updated;
  }
}
