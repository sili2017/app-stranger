import 'reflect-metadata';
import { OffersService } from '../../src/offers/offers.service';
import { OfferEventsProducer } from '../../src/events/offer-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T135 (FR-039): a successful screening appeal restores the offer as if
 * freshly published; a failed re-authorization (e.g. allowance exhausted since) leaves
 * it screening_rejected rather than silently bypassing the entitlement rule.
 */
describe('OffersService.restoreFromScreeningAppeal (T135, FR-039)', () => {
  async function buildRejectedOffer(prisma: FakePrismaService) {
    await prisma.meetOffer.create({
      data: {
        id: 'offer-1',
        creatorUserId: 'creator-1',
        cityId: 'mumbai',
        activityText: 'Board games',
        placeKind: 'pin',
        placeLat: 18.94,
        placeLng: 72.835,
        placeGeohash: 'abc123',
        lifetimeMinutes: 15,
        capacity: 2,
        status: 'screening_rejected',
        publishedAt: new Date(),
        expiresAt: new Date(),
        interestCount: 0,
        screeningPassed: false,
        screeningRuleVersion: 'v1',
        screeningEvaluatedAt: new Date(),
      },
    });
  }

  it('restores the offer to active with a fresh countdown when entitlement is re-authorized', async () => {
    const prisma = new FakePrismaService();
    const events = new OfferEventsProducer();
    const internal = {
      authorizeEntitlement: async () => ({
        decision: 'granted' as const,
        entitlementSource: 'free_allowance',
      }),
    };
    const service = new OffersService(prisma as any, events, internal as any);
    await buildRejectedOffer(prisma);

    const before = Date.now();
    const restored = await service.restoreFromScreeningAppeal('offer-1', 'corr-1');

    expect(restored).toBe(true);
    const offer = await prisma.meetOffer.findUnique({ where: { id: 'offer-1' } });
    expect(offer.status).toBe('active');
    expect(offer.publishedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(offer.expiresAt.getTime()).toBeGreaterThan(offer.publishedAt.getTime());
    expect(prisma.outboxRows.filter((r) => r.eventType === 'offer.published')).toHaveLength(1);
  });

  it('leaves the offer screening_rejected when entitlement re-authorization fails', async () => {
    const prisma = new FakePrismaService();
    const events = new OfferEventsProducer();
    const internal = {
      authorizeEntitlement: async () => ({ decision: 'denied' as const }),
    };
    const service = new OffersService(prisma as any, events, internal as any);
    await buildRejectedOffer(prisma);

    const restored = await service.restoreFromScreeningAppeal('offer-1', 'corr-1');

    expect(restored).toBe(false);
    const offer = await prisma.meetOffer.findUnique({ where: { id: 'offer-1' } });
    expect(offer.status).toBe('screening_rejected');
    expect(prisma.outboxRows.filter((r) => r.eventType === 'offer.published')).toHaveLength(0);
  });

  it('is a no-op for an offer that is not screening_rejected', async () => {
    const prisma = new FakePrismaService();
    const events = new OfferEventsProducer();
    const internal = { authorizeEntitlement: async () => ({ decision: 'granted' as const }) };
    const service = new OffersService(prisma as any, events, internal as any);
    await prisma.meetOffer.create({
      data: { id: 'offer-2', status: 'active', creatorUserId: 'creator-1', lifetimeMinutes: 15 },
    });

    const restored = await service.restoreFromScreeningAppeal('offer-2', 'corr-1');
    expect(restored).toBe(false);
  });
});
