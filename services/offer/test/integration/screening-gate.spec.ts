import 'reflect-metadata';
import { DomainError } from '@stranger/ts-platform';
import { OffersService } from '../../src/offers/offers.service';
import { OfferEventsProducer } from '../../src/events/offer-events.producer';
import { FakePrismaService } from '../fake-prisma';
import { publishOfferRequestFixture } from '@stranger/test-fixtures';

describe('Screening gate blocks entitlement reservation (T043, FR-039)', () => {
  it('returns 422 CONTENT_SCREENING_FAILED and never calls authorizeEntitlement', async () => {
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
    expect(prisma.offers.size).toBe(0);
  });
});
