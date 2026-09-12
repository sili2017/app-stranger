import 'reflect-metadata';
import { DomainError } from '@stranger/ts-platform';
import { OffersService } from '../../src/offers/offers.service';
import { OfferEventsProducer } from '../../src/events/offer-events.producer';
import { FakePrismaService } from '../fake-prisma';
import { publishOfferRequestFixture } from '@stranger/test-fixtures';

describe('Screening gate blocks entitlement reservation (T043, FR-039)', () => {
  it('returns 422 CONTENT_SCREENING_FAILED, never calls authorizeEntitlement, but persists the offer as screening_rejected (Convergence T128 — appealable)', async () => {
    const prisma = new FakePrismaService();
    const events = new OfferEventsProducer();
    let authorizeCalled = false;
    const internal = {
      screenOffer: async () => ({
        passed: false,
        ruleVersion: 'v1',
        evaluatedAt: new Date().toISOString(),
      }),
      authorizeEntitlement: async () => {
        authorizeCalled = true;
        return { decision: 'granted' as const, entitlementSource: 'free_allowance' };
      },
    };
    const service = new OffersService(prisma as any, events, internal as any);

    let caught: unknown;
    try {
      await service.publish('creator-1', publishOfferRequestFixture() as any, 'corr-1');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('CONTENT_SCREENING_FAILED');
    expect((caught as DomainError).httpStatus).toBe(422);
    expect(authorizeCalled).toBe(false);

    // Convergence T128: persisted (not discarded) so there's a real offerId to appeal
    // against — but never with an entitlement reservation, since screening failed first.
    expect(prisma.offers.size).toBe(1);
    const rejected = [...prisma.offers.values()][0];
    expect(rejected.status).toBe('screening_rejected');
    const offerIdDetail = (caught as DomainError).details.find((d) => d.field === 'offerId');
    expect(offerIdDetail?.issue).toBe(rejected.id);
  });
});
