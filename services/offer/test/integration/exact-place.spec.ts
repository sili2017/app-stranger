import 'reflect-metadata';
import { OffersService } from '../../src/offers/offers.service';
import { OfferEventsProducer } from '../../src/events/offer-events.producer';
import { FakePrismaService } from '../fake-prisma';
import { publishOfferRequestFixture } from '@stranger/test-fixtures';

/**
 * Regression test for a real gap found while building the Flutter client: the only
 * place that checked "is this caller the creator or an accepted-selection recipient"
 * (FR-002's scoped exact-place rule) was an /internal/v1/... route never reachable by an
 * actual client. getExactPlace exposes the identical check through a public route.
 */
describe('OffersService.getExactPlace (FR-002 scoped place lookup)', () => {
  function buildService(hasAcceptedSelection: boolean) {
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
      hasAcceptedSelection: async () => hasAcceptedSelection,
    };
    const service = new OffersService(prisma as any, events, internal as any);
    return service;
  }

  it('returns the exact place to the creator', async () => {
    const service = buildService(false);
    const offer = await service.publish(
      'creator-1',
      publishOfferRequestFixture({ capacity: 2 }) as any,
      'corr-1',
    );

    const place = await service.getExactPlace(offer.id, 'creator-1');
    expect(place.lat).toBe(offer.placeLat);
    expect(place.lng).toBe(offer.placeLng);
  });

  it('returns the exact place to a caller with an accepted selection', async () => {
    const service = buildService(true);
    const offer = await service.publish(
      'creator-1',
      publishOfferRequestFixture({ capacity: 2 }) as any,
      'corr-2',
    );

    const place = await service.getExactPlace(offer.id, 'selected-recipient');
    expect(place.lat).toBe(offer.placeLat);
  });

  it('rejects a caller with no accepted selection', async () => {
    const service = buildService(false);
    const offer = await service.publish(
      'creator-1',
      publishOfferRequestFixture({ capacity: 2 }) as any,
      'corr-3',
    );

    await expect(service.getExactPlace(offer.id, 'random-stranger')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('404s for an unknown offer', async () => {
    const service = buildService(false);
    await expect(service.getExactPlace('does-not-exist', 'anyone')).rejects.toMatchObject({
      code: 'OFFER_NOT_FOUND',
    });
  });
});
