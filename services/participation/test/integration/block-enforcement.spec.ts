import 'reflect-metadata';
import { ParticipationService } from '../../src/participation.service';
import { ParticipationEventsProducer } from '../../src/events/participation-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T126 (FR-015, Constitution §3.V): a block between the creator and a
 * recipient (in either direction) blocks a new selection, even if the expression of
 * interest was submitted before the block existed.
 */
describe('Block enforcement in selection (T126, FR-015)', () => {
  function buildService(blocked: boolean) {
    const prisma = new FakePrismaService();
    const events = new ParticipationEventsProducer();
    const internal = {
      getOfferStatus: async () => ({
        status: 'active' as const,
        capacity: 2,
        creatorUserId: 'creator-1',
      }),
      isEligibleRecipient: async () => true,
      isBlocked: async () => blocked,
    };
    const service = new ParticipationService(prisma as any, events, internal as any);
    return { service };
  }

  it('rejects a selection when the creator and recipient are blocked', async () => {
    const { service } = buildService(true);
    const eoi = await service.expressInterest('offer-1', 'recipient-a', undefined, 'corr-1');

    let caught: unknown;
    try {
      await service.select('offer-1', 'creator-1', eoi.id, 'corr-2');
    } catch (err) {
      caught = err;
    }

    expect((caught as { code?: string })?.code).toBe('NOT_ELIGIBLE');
  });

  it('allows a selection when there is no block', async () => {
    const { service } = buildService(false);
    const eoi = await service.expressInterest('offer-1', 'recipient-a', undefined, 'corr-1');

    const selection = await service.select('offer-1', 'creator-1', eoi.id, 'corr-2');

    expect(selection.recipientUserId).toBe('recipient-a');
  });
});
