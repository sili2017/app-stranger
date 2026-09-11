import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { TrustSafetyEventsProducer } from '../events/trust-safety-events.producer';
import { InternalClients } from './internal-clients';
import { SubmitRatingDto } from './dto';

@Injectable()
export class RatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TrustSafetyEventsProducer,
    private readonly internal: InternalClients,
  ) {}

  /**
   * T086: a participant can submit a rating only through the approved eligibility
   * check — a RatingPrompt record exists for this selection (i.e., the meetup resolved
   * to "happened", FR-029) — and the caller must be one of the two participants.
   * T029/FR-029: a photo naming other identifiable subjects is withheld from public
   * visibility until every named subject has consented.
   */
  async submit(raterUserId: string, dto: SubmitRatingDto, correlationId: string) {
    const prompt = await this.prisma.ratingPrompt.findUnique({
      where: { selectionId: dto.selectionId },
    });
    if (!prompt) {
      throw new DomainError(
        'NOT_RATING_ELIGIBLE',
        'errors.notRatingEligible',
        HttpStatus.FORBIDDEN,
      );
    }

    const creatorUserId =
      prompt.creatorUserId ?? (await this.internal.getOfferCreator(prompt.offerId));
    const recipientUserId =
      prompt.recipientUserId ?? (await this.internal.getSelectionRecipient(prompt.selectionId));
    if (!creatorUserId || !recipientUserId) {
      throw new DomainError(
        'NOT_RATING_ELIGIBLE',
        'errors.notRatingEligible',
        HttpStatus.FORBIDDEN,
      );
    }
    if (raterUserId !== creatorUserId && raterUserId !== recipientUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    const rateeUserId = raterUserId === creatorUserId ? recipientUserId : creatorUserId;

    const existing = await this.prisma.ratingFeedback.findUnique({
      where: { selectionId_raterUserId: { selectionId: dto.selectionId, raterUserId } },
    });
    if (existing) {
      // Idempotent retry: never re-emit trust.rating-submitted for an already-created rating.
      return existing;
    }

    const photoSubjects = dto.photoAssetId ? (dto.photoSubjectUserIds ?? []) : [];
    const needsConsent = photoSubjects.length > 0;
    const visibility = needsConsent ? 'pending_followup' : 'public';
    const photoConsent = photoSubjects.map((subjectUserId) => ({
      subjectUserId,
      consentedAt: null,
    }));

    const rating = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ratingFeedback.create({
        data: {
          offerId: prompt.offerId,
          selectionId: dto.selectionId,
          raterUserId,
          rateeUserId,
          starRating: dto.starRating,
          writtenFeedback: dto.writtenFeedback,
          photoAssetId: dto.photoAssetId,
          photoConsent: photoConsent as any,
          visibility,
          publicAt: visibility === 'public' ? new Date() : null,
        },
      });

      if (row.visibility === 'public') {
        await this.events.ratingSubmitted(
          tx as unknown as PrismaService,
          {
            ratingFeedbackId: row.id,
            offerId: row.offerId,
            rateeUserId: row.rateeUserId,
            starRating: row.starRating,
            visibility: 'public',
          },
          correlationId,
        );
      }
      return row;
    });

    return rating;
  }

  /** A named photo subject consents; once every subject has, the rating becomes public. */
  async consentToPhoto(subjectUserId: string, ratingFeedbackId: string, correlationId: string) {
    const rating = await this.prisma.ratingFeedback.findUnique({ where: { id: ratingFeedbackId } });
    if (!rating) {
      throw new DomainError('RATING_NOT_FOUND', 'errors.ratingNotFound', HttpStatus.NOT_FOUND);
    }
    const consents =
      (rating.photoConsent as { subjectUserId: string; consentedAt: string | null }[]) ?? [];
    if (!consents.some((c) => c.subjectUserId === subjectUserId)) {
      throw new DomainError('NOT_A_PHOTO_SUBJECT', 'errors.notAPhotoSubject', HttpStatus.FORBIDDEN);
    }

    const updatedConsents = consents.map((c) =>
      c.subjectUserId === subjectUserId ? { ...c, consentedAt: new Date().toISOString() } : c,
    );
    const allConsented = updatedConsents.every((c) => c.consentedAt !== null);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ratingFeedback.update({
        where: { id: ratingFeedbackId },
        data: {
          photoConsent: updatedConsents as any,
          ...(allConsented ? { visibility: 'public', publicAt: new Date() } : {}),
        },
      });
      if (allConsented) {
        await this.events.ratingSubmitted(
          tx as unknown as PrismaService,
          {
            ratingFeedbackId: row.id,
            offerId: row.offerId,
            rateeUserId: row.rateeUserId,
            starRating: row.starRating,
            visibility: 'public',
          },
          correlationId,
        );
      }
      return row;
    });

    return updated;
  }
}
