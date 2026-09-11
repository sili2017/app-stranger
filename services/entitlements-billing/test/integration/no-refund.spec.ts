import 'reflect-metadata';
import { EntitlementsService } from '../../src/entitlements.service';
import { FakePrismaService } from '../fake-prisma';
import { currentCalendarMonthKey } from '../../src/pricing';

/**
 * T096: stopping or letting an offer expire does not refund its allowance slot; a
 * rebroadcast consumes a new slot (FR-030, resolved via /speckit-clarify). Offer's own
 * stop/expire/rebroadcast logic never calls back into entitlements-billing to release a
 * reservation (verified in services/offer's own tests and live during development) —
 * this suite asserts entitlements-billing's own side of the contract: authorize() has
 * no release/refund method at all, so a slot, once granted, is permanently consumed
 * regardless of what later happens to the offer it was granted for.
 */
describe('No refund on stop/expire; rebroadcast counts again (T096, FR-030)', () => {
  it('does not expose any refund/release method — a granted slot cannot be given back', () => {
    const prisma = new FakePrismaService();
    const service = new EntitlementsService(prisma as any);

    expect((service as any).release).toBeUndefined();
    expect((service as any).refund).toBeUndefined();
  });

  it('a rebroadcast (a second authorize call for a different offerId) consumes a new slot', async () => {
    const prisma = new FakePrismaService();
    const service = new EntitlementsService(prisma as any);

    await service.authorize('user-1', 'offer-original');
    const afterOriginal = await service.getEntitlementStatus('user-1');
    expect(afterOriginal.remainingFreeAllowanceThisMonth).toBe(2);

    // A rebroadcast publishes a brand-new MeetOffer (verified in services/offer), so it
    // authorizes with a new offerId — exactly like any other publish.
    await service.authorize('user-1', 'offer-rebroadcast');
    const afterRebroadcast = await service.getEntitlementStatus('user-1');
    expect(afterRebroadcast.remainingFreeAllowanceThisMonth).toBe(1);

    const monthKey = currentCalendarMonthKey();
    const ledger = prisma.publishingEntitlementLedgerLookup('user-1', monthKey);
    expect(ledger.freeOffersUsedThisMonth).toBe(2);
  });
});
