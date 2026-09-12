import 'reflect-metadata';
import Stripe from 'stripe';
import { StripeWebhookController } from '../../src/payment-webhook/stripe-webhook.controller';
import { BillingEventsProducer } from '../../src/events/billing-events.producer';
import { FakePrismaService } from '../fake-prisma';

jest.mock('stripe');

/**
 * T124/ADR-009: Subscription rows must stay in sync with Stripe-side lifecycle
 * changes (renewal failure, cancellation) that arrive with no new request from our
 * client. Tests the controller directly (constructed with a FakePrismaService, per
 * this service's existing integration-test convention) rather than a full raw-body
 * HTTP round trip — the interesting logic is signature verification + row sync, both
 * exercisable without an actual Express request.
 */
describe('StripeWebhookController (T124, ADQ-004)', () => {
  const constructEvent = jest.fn();

  beforeEach(() => {
    constructEvent.mockReset();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({
      webhooks: { constructEvent },
    }));
  });

  function makeController(prisma: FakePrismaService) {
    return new StripeWebhookController(prisma as any, new BillingEventsProducer());
  }

  function fakeReq(rawBody: Buffer = Buffer.from('{}')) {
    return { rawBody } as any;
  }

  it('rejects an invalid signature with 400 and no leaked detail', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('signature mismatch — detail the client must never see');
    });
    const controller = makeController(new FakePrismaService());

    await expect(controller.handle(fakeReq(), 'bad-sig')).rejects.toMatchObject({ status: 400 });
  });

  it('customer.subscription.updated updates the matching row and emits billing.subscription-changed', async () => {
    const prisma = new FakePrismaService();
    prisma.subscription.__seed({
      id: 'sub-1',
      userId: 'user-1',
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      stripeSubscriptionId: 'stripe_sub_1',
    });
    const outboxCreate = jest.fn(prisma.outboxEvent.create);
    prisma.outboxEvent.create = outboxCreate;

    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: { id: 'stripe_sub_1', status: 'active', cancel_at_period_end: true },
      },
    });

    const result = await makeController(prisma).handle(fakeReq(), 'good-sig');

    expect(result).toEqual({ received: true });
    const updated = await prisma.subscription.findUnique({ where: { id: 'sub-1' } });
    expect(updated.status).toBe('cancelled_pending_period_end');
    expect(outboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'billing.subscription-changed' }),
      }),
    );
  });

  it('customer.subscription.deleted marks the subscription expired', async () => {
    const prisma = new FakePrismaService();
    prisma.subscription.__seed({
      id: 'sub-3',
      userId: 'user-3',
      plan: 'weekly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24),
      stripeSubscriptionId: 'stripe_sub_3',
    });
    constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'stripe_sub_3', status: 'canceled' } },
    });

    await makeController(prisma).handle(fakeReq(), 'good-sig');

    const updated = await prisma.subscription.findUnique({ where: { id: 'sub-3' } });
    expect(updated.status).toBe('expired');
  });

  it('invoice.payment_failed marks the matching subscription payment_failed', async () => {
    const prisma = new FakePrismaService();
    prisma.subscription.__seed({
      id: 'sub-2',
      userId: 'user-2',
      plan: 'yearly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 300),
      stripeSubscriptionId: 'stripe_sub_2',
    });
    constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_123',
          parent: { subscription_details: { subscription: 'stripe_sub_2' } },
        },
      },
    });

    await makeController(prisma).handle(fakeReq(), 'good-sig');

    const updated = await prisma.subscription.findUnique({ where: { id: 'sub-2' } });
    expect(updated.status).toBe('payment_failed');
  });

  it('an event for an unknown stripeSubscriptionId is a no-op, not an error', async () => {
    const prisma = new FakePrismaService();
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'stripe_sub_unknown', status: 'active' } },
    });

    await expect(makeController(prisma).handle(fakeReq(), 'good-sig')).resolves.toEqual({
      received: true,
    });
  });
});
