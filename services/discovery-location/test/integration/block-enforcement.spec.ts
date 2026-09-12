import 'reflect-metadata';
import { EligibilityService } from '../../src/eligibility/eligibility.service';
import { FakePrismaService, FakeInternalClients } from '../fake-prisma';
import { encodeGeohash } from './geohash-test-helper';

/**
 * Convergence T126 (FR-015, Constitution §3.V): a blocked creator's offers never
 * appear in the recipient's feed, and a blocked recipient is never fanned out to on
 * offer.published — regardless of distance/city eligibility otherwise matching.
 */
describe('Block enforcement in Discovery & Location (T126, FR-015)', () => {
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
    prisma.cityInterests.set('recipient-1', [{ userId: 'recipient-1', cityId: 'mumbai' }]);
    prisma.locations.set('recipient-1', {
      userId: 'recipient-1',
      lat: offerLat + 0.003,
      lng: offerLng + 0.003,
      source: 'live_gps',
      capturedAt: new Date(),
    });
    return prisma;
  }

  it('excludes an otherwise-eligible offer whose creator is blocked', async () => {
    const prisma = buildPrisma();
    const internal = new FakeInternalClients();
    internal.blockedPairs.add('recipient-1:creator-1');

    const service = new EligibilityService(prisma as any, internal as any);
    const results = await service.listEligibleForRecipient('recipient-1');

    expect(results).toHaveLength(0);
  });

  it('still includes the offer when there is no block', async () => {
    const prisma = buildPrisma();
    const service = new EligibilityService(prisma as any, new FakeInternalClients() as any);

    const results = await service.listEligibleForRecipient('recipient-1');

    expect(results.map((o) => o.offerId)).toEqual(['offer-1']);
  });

  it('excludes an otherwise-eligible recipient from the offer.published fan-out list when blocked', async () => {
    const prisma = buildPrisma();
    const internal = new FakeInternalClients();
    internal.blockedPairs.add('recipient-1:creator-1');

    const service = new EligibilityService(prisma as any, internal as any);
    const recipientIds = await service.listEligibleRecipientsForOffer('offer-1');

    expect(recipientIds).not.toContain('recipient-1');
  });

  it('includes the recipient in the fan-out list when there is no block', async () => {
    const prisma = buildPrisma();
    const service = new EligibilityService(prisma as any, new FakeInternalClients() as any);

    const recipientIds = await service.listEligibleRecipientsForOffer('offer-1');

    expect(recipientIds).toEqual(['recipient-1']);
  });
});
