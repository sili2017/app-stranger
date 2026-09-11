import 'reflect-metadata';
import { EntitlementsService } from '../../src/entitlements.service';
import { SubscriptionsService } from '../../src/subscriptions.service';
import { BillingEventsProducer } from '../../src/events/billing-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * T097: an active subscription bypasses the free-allowance check; cancelling preserves
 * entitlement only through the current paid period with no refund (FR-032, SC-016).
 */
describe('Subscription bypass and cancellation (T097, FR-032, SC-016)', () => {
  it('bypasses the free allowance entirely while a subscription is active', async () => {
    const prisma = new FakePrismaService();
    const entitlements = new EntitlementsService(prisma as any);

    prisma.subscription.__seed({
      id: 'sub-1',
      userId: 'user-1',
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    for (let i = 0; i < 5; i++) {
      const result = await entitlements.authorize('user-1', `offer-${i}`);
      expect(result).toEqual({ decision: 'granted', entitlementSource: 'subscription' });
    }

    const status = await entitlements.getEntitlementStatus('user-1');
    expect(status.remainingFreeAllowanceThisMonth).toBeNull();
    expect(status.hasActiveSubscription).toBe(true);
  });

  it('cancelling preserves entitlement through currentPeriodEnd with no refund, via cancelled_pending_period_end', async () => {
    const prisma = new FakePrismaService();
    const events = new BillingEventsProducer();
    const subscriptions = new SubscriptionsService(prisma as any, events);
    const entitlements = new EntitlementsService(prisma as any);

    const futurePeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    prisma.subscription.__seed({
      id: 'sub-2',
      userId: 'user-2',
      plan: 'yearly',
      status: 'active',
      currentPeriodEnd: futurePeriodEnd,
      basePriceMinor: 9999,
      discountPct: 20,
      currency: 'USD',
    });

    const cancelled = await subscriptions.cancel('user-2', 'sub-2', 'corr-1');
    expect(cancelled.status).toBe('cancelled_pending_period_end');
    expect(cancelled.currentPeriodEnd).toEqual(futurePeriodEnd); // unchanged — no early termination

    // Still grants via subscription until currentPeriodEnd (constitution: no silent
    // mid-period entitlement loss).
    const result = await entitlements.authorize('user-2', 'offer-1');
    expect(result).toEqual({ decision: 'granted', entitlementSource: 'subscription' });
  });
});
