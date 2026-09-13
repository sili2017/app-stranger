import 'reflect-metadata';
import { ParticipationService } from '../../src/participation.service';
import { ParticipationEventsProducer } from '../../src/events/participation-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * Feature 21: expressInterest used to emit participation.interest-expressed on every
 * call, even a retried/duplicate one for the same (offerId, recipientUserId) — this
 * double-counted MeetOffer.interestCount (and Discovery & Location's own copy) and
 * double-notified the creator. Fixed by only emitting on genuine row creation.
 */
describe('Duplicate expressInterest calls (Feature 21)', () => {
  function buildService() {
    const prisma = new FakePrismaService();
    const events = new ParticipationEventsProducer();
    const internal = {
      getOfferStatus: async () => ({
        status: 'active' as const,
        capacity: 2,
        creatorUserId: 'creator-1',
      }),
      isEligibleRecipient: async () => true,
    };
    const service = new ParticipationService(prisma as any, events, internal as any);
    return { service, prisma };
  }

  it('emits exactly one interest-expressed event across two identical calls', async () => {
    const { service, prisma } = buildService();

    const first = await service.expressInterest('offer-1', 'recipient-1', undefined, 'corr-1');
    const second = await service.expressInterest('offer-1', 'recipient-1', undefined, 'corr-2');

    expect(second.id).toBe(first.id);
    const interestEvents = prisma.outboxRows.filter(
      (row) => row.eventType === 'participation.interest-expressed',
    );
    expect(interestEvents).toHaveLength(1);
  });

  it('getMyExpressionOfInterest reflects expressed state', async () => {
    const { service } = buildService();

    expect(await service.getMyExpressionOfInterest('offer-1', 'recipient-1')).toEqual({
      expressed: false,
    });

    await service.expressInterest('offer-1', 'recipient-1', undefined, 'corr-1');

    expect(await service.getMyExpressionOfInterest('offer-1', 'recipient-1')).toEqual({
      expressed: true,
    });
  });
});
