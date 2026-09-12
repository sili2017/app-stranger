import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TrustSafetyEventsProducer } from '../events/trust-safety-events.producer';

/**
 * Convergence T127 (FR-029, Clarifications Session 2026-09-12 round 2): a one-sided
 * rating (no counterpart yet) is held pending for up to 5 days, then made public on
 * its own — but only once its own photo-consent gate is separately satisfied; the SLA
 * never bypasses consent. The mutual-submission path (both parties rate) is handled
 * synchronously in RatingService.submit, not here.
 */
export const RATING_VISIBILITY_SLA_MS = 5 * 24 * 60 * 60 * 1000;

@Injectable()
export class RatingVisibilitySlaScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TrustSafetyEventsProducer,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const deadline = new Date(Date.now() - RATING_VISIBILITY_SLA_MS);
    const candidates = await this.prisma.ratingFeedback.findMany({
      where: { visibility: 'pending_followup', createdAt: { lte: deadline } },
    });

    for (const rating of candidates) {
      const consent = (rating.photoConsent as { consentedAt: string | null }[]) ?? [];
      const consentSatisfied = consent.every((c) => c.consentedAt !== null);
      if (!consentSatisfied) continue; // consent is a hard gate the SLA never bypasses

      await this.prisma.$transaction(async (tx) => {
        const row = await tx.ratingFeedback.update({
          where: { id: rating.id },
          data: { visibility: 'public', publicAt: new Date() },
        });
        await this.events.ratingSubmitted(
          tx as unknown as PrismaService,
          {
            ratingFeedbackId: row.id,
            offerId: row.offerId,
            rateeUserId: row.rateeUserId,
            starRating: row.starRating,
            visibility: 'public',
          },
          'rating-visibility-sla-scheduler',
        );
      });
    }
  }
}
