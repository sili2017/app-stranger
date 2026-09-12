import 'reflect-metadata';
import { RatingService } from '../../src/rating/rating.service';
import { TrustSafetyEventsProducer } from '../../src/events/trust-safety-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * T082: a feedback photo showing another identifiable person is withheld from public
 * visibility until that person's consent record exists (FR-029).
 */
describe('Feedback photo consent gate (T082, FR-029)', () => {
  function buildService() {
    const prisma = new FakePrismaService();
    const events = new TrustSafetyEventsProducer();
    const internal = {
      getOfferCreator: async () => 'creator-1',
      getSelectionRecipient: async () => 'recipient-1',
    };
    const service = new RatingService(prisma as any, events, internal as any);
    return { service, prisma };
  }

  it('withholds a rating with a named third-party photo subject until they consent, even with a counterpart rating already in', async () => {
    const { service, prisma } = buildService();
    await prisma.ratingPrompt.upsert({
      where: { selectionId: 'selection-1' },
      create: {
        offerId: 'offer-1',
        selectionId: 'selection-1',
        resolvedAt: new Date(),
        scheduledSendAt: new Date(),
      },
    });
    // Convergence T127: a counterpart rating already exists, so the mutual-submission
    // rule alone would otherwise publish immediately — consent must still gate it.
    await service.submit('creator-1', { selectionId: 'selection-1', starRating: 5 }, 'corr-0');

    const rating = await service.submit(
      'recipient-1',
      {
        selectionId: 'selection-1',
        starRating: 5,
        photoAssetId: 'asset-1',
        photoSubjectUserIds: ['third-party-1'],
      },
      'corr-1',
    );

    // This rating (with the pending photo) stays gated even though its counterpart
    // exists — but the counterpart's own already-consent-clear rating (no photo)
    // correctly publishes right now, since both ratings' visibility is independent.
    expect(rating.visibility).toBe('pending_followup');
    expect(
      prisma.outboxRows.filter(
        (r) => r.eventType === 'trust.rating-submitted' && r.data?.ratingFeedbackId === rating.id,
      ),
    ).toHaveLength(0);

    const consented = await service.consentToPhoto('third-party-1', rating.id, 'corr-2');

    expect(consented.visibility).toBe('public');
    expect(
      prisma.outboxRows.filter(
        (r) => r.eventType === 'trust.rating-submitted' && r.data?.ratingFeedbackId === rating.id,
      ),
    ).toHaveLength(1);
  });

  it('publishes immediately when no photo is attached AND a counterpart rating already exists (T127 mutual rule)', async () => {
    const { service, prisma } = buildService();
    await prisma.ratingPrompt.upsert({
      where: { selectionId: 'selection-2' },
      create: {
        offerId: 'offer-1',
        selectionId: 'selection-2',
        resolvedAt: new Date(),
        scheduledSendAt: new Date(),
      },
    });
    await service.submit('creator-1', { selectionId: 'selection-2', starRating: 4 }, 'corr-0');

    const rating = await service.submit(
      'recipient-1',
      { selectionId: 'selection-2', starRating: 4 },
      'corr-1',
    );

    expect(rating.visibility).toBe('public');
    // Both ratings become public on the second submission, not just the new one.
    const counterpart = await prisma.ratingFeedback.findUnique({
      where: { selectionId_raterUserId: { selectionId: 'selection-2', raterUserId: 'creator-1' } },
    });
    expect(counterpart.visibility).toBe('public');
  });

  it('holds a one-sided, no-photo rating pending until a counterpart rates or the SLA elapses (T127)', async () => {
    const { service, prisma } = buildService();
    await prisma.ratingPrompt.upsert({
      where: { selectionId: 'selection-3' },
      create: {
        offerId: 'offer-1',
        selectionId: 'selection-3',
        resolvedAt: new Date(),
        scheduledSendAt: new Date(),
      },
    });

    const rating = await service.submit(
      'recipient-1',
      { selectionId: 'selection-3', starRating: 3 },
      'corr-1',
    );

    expect(rating.visibility).toBe('pending_followup');
    expect(prisma.outboxRows.filter((r) => r.eventType === 'trust.rating-submitted')).toHaveLength(
      0,
    );
  });
});
