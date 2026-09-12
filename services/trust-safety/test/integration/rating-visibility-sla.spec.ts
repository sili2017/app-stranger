import 'reflect-metadata';
import { RatingService } from '../../src/rating/rating.service';
import {
  RatingVisibilitySlaScheduler,
  RATING_VISIBILITY_SLA_MS,
} from '../../src/rating/rating-visibility-sla-scheduler';
import { TrustSafetyEventsProducer } from '../../src/events/trust-safety-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T127 (FR-029, Clarifications Session 2026-09-12 round 2): a one-sided
 * rating becomes public on its own once the 5-day SLA elapses — but only if its own
 * photo-consent gate is already satisfied; the SLA never bypasses consent.
 */
describe('RatingVisibilitySlaScheduler (T127, FR-029)', () => {
  function buildPrompt(prisma: FakePrismaService, selectionId: string) {
    return prisma.ratingPrompt.upsert({
      where: { selectionId },
      create: { offerId: 'offer-1', selectionId, resolvedAt: new Date(), scheduledSendAt: new Date() },
    });
  }

  async function backdate(prisma: FakePrismaService, selectionId: string, raterUserId: string, ms: number) {
    const row = await prisma.ratingFeedback.findUnique({
      where: { selectionId_raterUserId: { selectionId, raterUserId } },
    });
    row.createdAt = new Date(Date.now() - ms);
  }

  it('publishes a one-sided, consent-clear rating once the 5-day SLA has elapsed', async () => {
    const prisma = new FakePrismaService();
    const events = new TrustSafetyEventsProducer();
    const internal = { getOfferCreator: async () => 'creator-1', getSelectionRecipient: async () => 'recipient-1' };
    const rating = new RatingService(prisma as any, events, internal as any);
    const scheduler = new RatingVisibilitySlaScheduler(prisma as any, events);

    await buildPrompt(prisma, 'selection-1');
    const row = await rating.submit('recipient-1', { selectionId: 'selection-1', starRating: 5 }, 'corr-1');
    expect(row.visibility).toBe('pending_followup');

    await backdate(prisma, 'selection-1', 'recipient-1', RATING_VISIBILITY_SLA_MS + 60_000);
    await scheduler.tick();

    const after = await prisma.ratingFeedback.findUnique({
      where: { selectionId_raterUserId: { selectionId: 'selection-1', raterUserId: 'recipient-1' } },
    });
    expect(after.visibility).toBe('public');
    expect(prisma.outboxRows.filter((r) => r.eventType === 'trust.rating-submitted')).toHaveLength(1);
  });

  it('does not publish before the 5-day SLA has elapsed', async () => {
    const prisma = new FakePrismaService();
    const events = new TrustSafetyEventsProducer();
    const internal = { getOfferCreator: async () => 'creator-1', getSelectionRecipient: async () => 'recipient-1' };
    const rating = new RatingService(prisma as any, events, internal as any);
    const scheduler = new RatingVisibilitySlaScheduler(prisma as any, events);

    await buildPrompt(prisma, 'selection-2');
    await rating.submit('recipient-1', { selectionId: 'selection-2', starRating: 5 }, 'corr-1');
    await backdate(prisma, 'selection-2', 'recipient-1', RATING_VISIBILITY_SLA_MS - 60_000);

    await scheduler.tick();

    const after = await prisma.ratingFeedback.findUnique({
      where: { selectionId_raterUserId: { selectionId: 'selection-2', raterUserId: 'recipient-1' } },
    });
    expect(after.visibility).toBe('pending_followup');
  });

  it('never bypasses an unresolved photo-consent gate, even past the SLA', async () => {
    const prisma = new FakePrismaService();
    const events = new TrustSafetyEventsProducer();
    const internal = { getOfferCreator: async () => 'creator-1', getSelectionRecipient: async () => 'recipient-1' };
    const rating = new RatingService(prisma as any, events, internal as any);
    const scheduler = new RatingVisibilitySlaScheduler(prisma as any, events);

    await buildPrompt(prisma, 'selection-3');
    await rating.submit(
      'recipient-1',
      { selectionId: 'selection-3', starRating: 5, photoAssetId: 'asset-1', photoSubjectUserIds: ['third-party-1'] },
      'corr-1',
    );
    await backdate(prisma, 'selection-3', 'recipient-1', RATING_VISIBILITY_SLA_MS + 60_000);

    await scheduler.tick();

    const after = await prisma.ratingFeedback.findUnique({
      where: { selectionId_raterUserId: { selectionId: 'selection-3', raterUserId: 'recipient-1' } },
    });
    expect(after.visibility).toBe('pending_followup');
  });
});
