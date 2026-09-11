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

  it('withholds a rating with a named third-party photo subject until they consent', async () => {
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

    expect(rating.visibility).toBe('pending_followup');
    expect(prisma.outboxRows.filter((r) => r.eventType === 'trust.rating-submitted')).toHaveLength(
      0,
    );

    const consented = await service.consentToPhoto('third-party-1', rating.id, 'corr-2');

    expect(consented.visibility).toBe('public');
    expect(prisma.outboxRows.filter((r) => r.eventType === 'trust.rating-submitted')).toHaveLength(
      1,
    );
  });

  it('publishes immediately when no photo (or no named subjects) is attached', async () => {
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

    const rating = await service.submit(
      'recipient-1',
      { selectionId: 'selection-2', starRating: 4 },
      'corr-1',
    );

    expect(rating.visibility).toBe('public');
  });
});
