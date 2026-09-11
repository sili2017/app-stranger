import 'reflect-metadata';
import { OffersService } from '../../src/offers/offers.service';
import { OfferEventsProducer } from '../../src/events/offer-events.producer';
import { ExpiryScheduler } from '../../src/offers/expiry-scheduler';
import { FakePrismaService } from '../fake-prisma';
import { publishOfferRequestFixture } from '@stranger/test-fixtures';

describe('Offer lifecycle: publish -> active -> expire (T042)', () => {
  it('defaults to a 15-minute lifetime, is active immediately, then expires via the scheduler', async () => {
    const prisma = new FakePrismaService();
    const events = new OfferEventsProducer();
    const internal = {
      screenOffer: async () => ({
        passed: true,
        ruleVersion: 'v1',
        evaluatedAt: new Date().toISOString(),
      }),
      authorizeEntitlement: async () => ({
        decision: 'granted' as const,
        entitlementSource: 'free_allowance',
      }),
    };
    const service = new OffersService(prisma as any, events, internal as any);

    const offer = await service.publish(
      'creator-1',
      publishOfferRequestFixture({ capacity: 3 }) as any,
      'corr-1',
    );

    expect(offer.status).toBe('active');
    const expectedExpiry = new Date(offer.publishedAt.getTime() + 15 * 60_000);
    expect(offer.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    expect(prisma.outboxRows.some((r) => r.eventType === 'offer.published')).toBe(true);

    // Simulate expiry having passed, then run the scheduler tick.
    prisma.offers.get(offer.id).expiresAt = new Date(Date.now() - 1000);
    const scheduler = new ExpiryScheduler(prisma as any, events);
    await scheduler.tick();

    const afterTick = await service.getById(offer.id);
    expect(afterTick.status).toBe('expired');
    expect(prisma.outboxRows.some((r) => r.eventType === 'offer.expired')).toBe(true);
  });

  it('rejects a new expression-adjacent action once stopped (FR-011): stop is idempotent-safe against re-stop', async () => {
    const prisma = new FakePrismaService();
    const events = new OfferEventsProducer();
    const internal = {
      screenOffer: async () => ({
        passed: true,
        ruleVersion: 'v1',
        evaluatedAt: new Date().toISOString(),
      }),
      authorizeEntitlement: async () => ({
        decision: 'granted' as const,
        entitlementSource: 'free_allowance',
      }),
    };
    const service = new OffersService(prisma as any, events, internal as any);

    const offer = await service.publish(
      'creator-1',
      publishOfferRequestFixture({ capacity: 1 }) as any,
      'corr-1',
    );
    await service.stop(offer.id, 'creator-1', 'corr-2');

    await expect(service.stop(offer.id, 'creator-1', 'corr-3')).rejects.toThrow();
  });
});
