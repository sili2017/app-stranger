import 'reflect-metadata';
import { EligibilityService } from '../../src/eligibility/eligibility.service';
import { FakePrismaService } from '../fake-prisma';
import { encodeGeohash } from './geohash-test-helper';

/**
 * T054: a recipient inside the 5 km eligibility radius with a matching city interest
 * sees the offer; a recipient outside the radius does not (FR-004, SC-002). Exercised
 * against an in-memory Prisma double (no live Postgres in this environment) — verified
 * separately against real Postgres + Redis via a live smoke test during development
 * (see conversation record); this suite makes the same assertions reproducible in CI.
 */
describe('Eligibility radius (T054, FR-004)', () => {
  const offerLat = 18.94;
  const offerLng = 72.835;
  const offerGeohash = encodeGeohash(offerLat, offerLng);

  function buildPrisma() {
    const prisma = new FakePrismaService();
    prisma.discoveryEligibility.set('offer-1', {
      offerId: 'offer-1',
      creatorUserId: 'creator-1',
      cityId: 'mumbai',
      placeGeohash: offerGeohash,
      placeKind: 'pin',
      activityText: 'Board games',
      lifetimeMinutes: 15,
      capacity: 2,
      status: 'active',
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      interestCount: 0,
    });
    return prisma;
  }

  it('includes a recipient within the 5km radius with a matching city interest', async () => {
    const prisma = buildPrisma();
    prisma.cityInterests.set('recipient-near', [{ userId: 'recipient-near', cityId: 'mumbai' }]);
    prisma.locations.set('recipient-near', {
      userId: 'recipient-near',
      lat: offerLat + 0.003,
      lng: offerLng + 0.003,
      source: 'live_gps',
      capturedAt: new Date(),
    });

    const service = new EligibilityService(prisma as any);
    const results = await service.listEligibleForRecipient('recipient-near');

    expect(results).toHaveLength(1);
    expect(results[0].offerId).toBe('offer-1');
    expect(results[0].distanceBand).toBe('<1km');
  });

  it('excludes a recipient outside the 5km radius even with a matching city interest', async () => {
    const prisma = buildPrisma();
    prisma.cityInterests.set('recipient-far', [{ userId: 'recipient-far', cityId: 'mumbai' }]);
    prisma.locations.set('recipient-far', {
      userId: 'recipient-far',
      lat: offerLat + 0.2, // ~22km north
      lng: offerLng,
      source: 'live_gps',
      capturedAt: new Date(),
    });

    const service = new EligibilityService(prisma as any);
    const results = await service.listEligibleForRecipient('recipient-far');

    expect(results).toHaveLength(0);
  });

  it('excludes a recipient with no matching city interest even if physically close', async () => {
    const prisma = buildPrisma();
    prisma.cityInterests.set('recipient-wrong-city', [
      { userId: 'recipient-wrong-city', cityId: 'delhi' },
    ]);
    prisma.locations.set('recipient-wrong-city', {
      userId: 'recipient-wrong-city',
      lat: offerLat,
      lng: offerLng,
      source: 'live_gps',
      capturedAt: new Date(),
    });

    const service = new EligibilityService(prisma as any);
    const results = await service.listEligibleForRecipient('recipient-wrong-city');

    expect(results).toHaveLength(0);
  });
});
