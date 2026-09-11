import 'reflect-metadata';
import {
  FOLLOWUP_DELAY_MS,
  computeScheduledSendAt,
  shouldCreatePromptFor,
} from '../../src/rating/rating-eligibility.consumer';
import { RatingPromptScheduler } from '../../src/rating/rating-prompt-scheduler';
import { FakePrismaService } from '../fake-prisma';

/**
 * T083: the rating prompt fires exactly 2 hours after
 * participation.selection-resolved(outcome: happened), never instantly.
 */
describe('Rating prompt delay (T083, FR-029)', () => {
  it('schedules exactly 2 hours (not instantly) after resolution, only for a happened outcome', () => {
    expect(FOLLOWUP_DELAY_MS).toBe(2 * 60 * 60 * 1000);

    const resolvedAt = new Date('2026-09-10T12:00:00Z');
    const scheduled = computeScheduledSendAt(resolvedAt);

    expect(scheduled.getTime() - resolvedAt.getTime()).toBe(2 * 60 * 60 * 1000);
    expect(scheduled.toISOString()).toBe('2026-09-10T14:00:00.000Z');

    expect(shouldCreatePromptFor('happened')).toBe(true);
    expect(shouldCreatePromptFor('cancelled')).toBe(false);
  });

  it('the scheduler never sends a prompt before its scheduledSendAt', async () => {
    const prisma = new FakePrismaService();
    const notYetDue = computeScheduledSendAt(new Date()); // 2h from now
    await prisma.ratingPrompt.upsert({
      where: { selectionId: 'selection-1' },
      create: {
        offerId: 'offer-1',
        selectionId: 'selection-1',
        resolvedAt: new Date(),
        scheduledSendAt: notYetDue,
      },
    });

    const internal = {
      getOfferCreator: async () => 'creator-1',
      getSelectionRecipient: async () => 'recipient-1',
    };
    const scheduler = new RatingPromptScheduler(prisma as any, internal as any);
    await scheduler.tick();

    const prompt = await prisma.ratingPrompt.findUnique({ where: { selectionId: 'selection-1' } });
    expect(prompt.sentAt).toBeNull();
  });

  it('the scheduler sends a prompt once its scheduledSendAt has passed', async () => {
    const prisma = new FakePrismaService();
    await prisma.ratingPrompt.upsert({
      where: { selectionId: 'selection-2' },
      create: {
        offerId: 'offer-1',
        selectionId: 'selection-2',
        resolvedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        scheduledSendAt: new Date(Date.now() - 60 * 60 * 1000), // 1h in the past
      },
    });

    const internal = {
      getOfferCreator: async () => 'creator-1',
      getSelectionRecipient: async () => 'recipient-1',
    };
    const scheduler = new RatingPromptScheduler(prisma as any, internal as any);
    await scheduler.tick();

    const prompt = await prisma.ratingPrompt.findUnique({ where: { selectionId: 'selection-2' } });
    expect(prompt.sentAt).not.toBeNull();
    expect(prompt.creatorUserId).toBe('creator-1');
    expect(prompt.recipientUserId).toBe('recipient-1');
  });
});
