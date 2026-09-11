import 'reflect-metadata';
import { DomainError } from '@stranger/ts-platform';
import { ParticipationService } from '../../src/participation.service';
import { ParticipationEventsProducer } from '../../src/events/participation-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * T067: expiring an offer mid-submission returns 409 OFFER_NOT_ACTIVE and creates no
 * chat — verified here as "no ExpressionOfInterest/Selection recorded", since the
 * chat itself is Messaging's responsibility and only ever created from a
 * participation.participant-selected event this flow never emits.
 */
describe('Race: offer expires mid-submission (T067, Edge Cases)', () => {
  it('rejects express-interest with 409 OFFER_NOT_ACTIVE when Offer reports the offer is no longer active', async () => {
    const prisma = new FakePrismaService();
    const events = new ParticipationEventsProducer();
    const internal = {
      getOfferStatus: async () => ({
        status: 'expired' as const,
        capacity: 2,
        creatorUserId: 'creator-1',
      }),
      isEligibleRecipient: async () => true,
    };
    const service = new ParticipationService(prisma as any, events, internal as any);

    let caught: unknown;
    try {
      await service.expressInterest('offer-1', 'recipient-1', undefined, 'corr-1');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('OFFER_NOT_ACTIVE');
    expect((caught as DomainError).httpStatus).toBe(409);
    expect(prisma.outboxRows).toHaveLength(0);
  });
});
