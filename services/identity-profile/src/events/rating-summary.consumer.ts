import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, createEventBus } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

const CONSUMER_NAME = 'identity-profile';

/**
 * T087: consumes trust.rating-submitted (fired only on a visibility transition to
 * public — never on initial submission) to refresh PublicProfile.publicRatingSummary.
 * Only average + count are stored here — individual feedback text/photos stay in
 * Trust & Safety, never mirrored into a public-profile read model (data-model.md
 * Sensitive-Data Classification: Controlled public only via the approved profile view).
 */
@Injectable()
export class RatingSummaryConsumer implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = createEventBus(this.redisUrl, 'identity-profile');
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe<Record<string, unknown>>('trust.rating-submitted', (e) =>
      this.guarded(e, () => this.onRatingSubmitted(e)),
    );
  }

  private async guarded(event: DomainEvent, handler: () => Promise<void>): Promise<void> {
    const isNew = await this.idempotency.markProcessedIfNew(CONSUMER_NAME, event.eventId);
    if (!isNew) return;
    await handler();
  }

  private async onRatingSubmitted(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    const rateeUserId = String(d.rateeUserId);
    const starRating = Number(d.starRating);

    const profile = await this.prisma.publicProfile.findUnique({ where: { userId: rateeUserId } });
    if (!profile) return; // no public profile yet for this user — nothing to refresh

    const priorCount = profile.publicRatingCount;
    const priorAverage = profile.publicRatingAverage ?? 0;
    const newCount = priorCount + 1;
    const newAverage = (priorAverage * priorCount + starRating) / newCount;

    await this.prisma.publicProfile.update({
      where: { userId: rateeUserId },
      data: { publicRatingAverage: newAverage, publicRatingCount: newCount },
    });
  }
}
