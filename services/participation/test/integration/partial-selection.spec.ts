import 'reflect-metadata';
import { ParticipationService } from '../../src/participation.service';
import { ParticipationEventsProducer } from '../../src/events/participation-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * T068: creator selects fewer recipients than expressed interest — the unselected
 * recipient gets no explicit non-selection notice (FR-008, FR-042, SC-020, resolved via
 * /speckit-clarify). This suite asserts the two guarantees the spec actually makes:
 * (1) selecting one EOI never touches or notifies the other, still-unselected EOI, and
 * (2) capacity is enforced from live Offer data, not a stale client-supplied value.
 */
describe('Partial selection (T068, FR-008, FR-042)', () => {
  function buildService(capacity: number) {
    const prisma = new FakePrismaService();
    const events = new ParticipationEventsProducer();
    const internal = {
      getOfferStatus: async () => ({
        status: 'active' as const,
        capacity,
        creatorUserId: 'creator-1',
      }),
      isEligibleRecipient: async () => true,
      isBlocked: async () => false,
    };
    const service = new ParticipationService(prisma as any, events, internal as any);
    return { service, prisma };
  }

  it('selecting one of two interested recipients leaves the other EOI untouched and unnotified', async () => {
    const { service, prisma } = buildService(2);

    const eoiA = await service.expressInterest('offer-1', 'recipient-a', undefined, 'corr-1');
    const eoiB = await service.expressInterest('offer-1', 'recipient-b', undefined, 'corr-2');

    const selection = await service.select('offer-1', 'creator-1', eoiA.id, 'corr-3');

    expect(selection.recipientUserId).toBe('recipient-a');
    // Both EOIs legitimately produce an interest-expressed event (FR-042's +1 signal
    // for every expression of interest) — what must never happen is a *selection*
    // event for the recipient who was not selected.
    const selectionEventsAboutB = prisma.outboxRows.filter(
      (row) =>
        row.eventType === 'participation.participant-selected' &&
        row.data?.expressionOfInterestId === eoiB.id,
    );
    expect(selectionEventsAboutB).toHaveLength(0);
  });

  it('rejects a selection once live capacity (from Offer, not a stale client value) is reached', async () => {
    const { service } = buildService(1);

    const eoiA = await service.expressInterest('offer-1', 'recipient-a', undefined, 'corr-1');
    const eoiB = await service.expressInterest('offer-1', 'recipient-b', undefined, 'corr-2');

    await service.select('offer-1', 'creator-1', eoiA.id, 'corr-3');

    let caught: unknown;
    try {
      await service.select('offer-1', 'creator-1', eoiB.id, 'corr-4');
    } catch (err) {
      caught = err;
    }

    expect((caught as any)?.code).toBe('CAPACITY_REACHED');
  });
});
