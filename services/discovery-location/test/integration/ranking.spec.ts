import 'reflect-metadata';
import { EligibilityService } from '../../src/eligibility/eligibility.service';
import { FakePrismaService } from '../fake-prisma';
import { encodeGeohash } from './geohash-test-helper';

/**
 * T055: with two registered city interests, an offer matching the recipient's
 * current-location city ranks ahead of an offer for the other registered city (FR-005,
 * SC-003). Ranking is implemented as ascending distance from the recipient's current
 * location (see EligibilityService's doc comment for why) — this test asserts the
 * concrete, spec-required outcome: the near offer ranks first.
 */
describe('Current-location ranking priority (T055, FR-005)', () => {
  it("ranks the offer near the recipient's current location ahead of a farther, otherwise-eligible offer", async () => {
    const prisma = new FakePrismaService();
    const nearLat = 18.94;
    const nearLng = 72.835;
    // ~4km away — still within the 5km radius, but farther than the "near" offer.
    const farLat = 18.975;
    const farLng = 72.835;

    prisma.discoveryEligibility.set('offer-near', {
      offerId: 'offer-near',
      creatorUserId: 'creator-a',
      cityId: 'mumbai',
      placeGeohash: encodeGeohash(nearLat, nearLng),
      placeKind: 'pin',
      activityText: 'Coffee',
      lifetimeMinutes: 15,
      capacity: 2,
      status: 'active',
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      interestCount: 0,
    });
    prisma.discoveryEligibility.set('offer-far', {
      offerId: 'offer-far',
      creatorUserId: 'creator-b',
      cityId: 'mumbai',
      placeGeohash: encodeGeohash(farLat, farLng),
      placeKind: 'pin',
      activityText: 'Coffee',
      lifetimeMinutes: 15,
      capacity: 2,
      status: 'active',
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      interestCount: 0,
    });

    prisma.cityInterests.set('recipient-1', [
      { userId: 'recipient-1', cityId: 'mumbai' },
      { userId: 'recipient-1', cityId: 'delhi' },
    ]);
    // Recipient's current location is right next to offer-near.
    prisma.locations.set('recipient-1', {
      userId: 'recipient-1',
      lat: nearLat + 0.001,
      lng: nearLng,
      source: 'live_gps',
      capturedAt: new Date(),
    });

    const service = new EligibilityService(prisma as any);
    const results = await service.listEligibleForRecipient('recipient-1');

    expect(results.map((r) => r.offerId)).toEqual(['offer-near', 'offer-far']);
  });
});
