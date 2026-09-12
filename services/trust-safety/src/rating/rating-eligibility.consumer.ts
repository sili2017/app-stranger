import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, createEventBus } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

const CONSUMER_NAME = 'trust-safety';
export const FOLLOWUP_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours (FR-029, resolved via /speckit-clarify)

/** Pure computation, extracted for testability (T083: never instantly, exactly 2h later). */
export function computeScheduledSendAt(resolvedAt: Date): Date {
  return new Date(resolvedAt.getTime() + FOLLOWUP_DELAY_MS);
}

export function shouldCreatePromptFor(outcome: unknown): boolean {
  return outcome === 'happened';
}

/**
 * T085: on participation.selection-resolved(outcome: happened), creates the
 * RatingPrompt eligibility record and schedules the async prompt for exactly 2 hours
 * later — never instantly. A `cancelled` outcome creates no prompt at all (only a
 * qualifying, non-cancelled meeting is rating-eligible — FR-029).
 */
@Injectable()
export class RatingEligibilityConsumer implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = createEventBus(this.redisUrl, 'trust-safety');
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.selection-resolved',
      (e) => this.guarded(e, () => this.onSelectionResolved(e)),
    );
  }

  private async guarded(event: DomainEvent, handler: () => Promise<void>): Promise<void> {
    const isNew = await this.idempotency.markProcessedIfNew(CONSUMER_NAME, event.eventId);
    if (!isNew) return;
    await handler();
  }

  private async onSelectionResolved(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    if (!shouldCreatePromptFor(d.outcome)) return;

    const resolvedAt = new Date(String(d.resolvedAt));
    await this.prisma.ratingPrompt.upsert({
      where: { selectionId: String(d.selectionId) },
      create: {
        offerId: String(d.offerId),
        selectionId: String(d.selectionId),
        resolvedAt,
        scheduledSendAt: computeScheduledSendAt(resolvedAt),
      },
      update: {},
    });
  }
}
