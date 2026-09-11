import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, RedisEventBus } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { ParticipationService } from '../participation.service';

const CONSUMER_NAME = 'participation';

/**
 * T080/T075: the spec never names an explicit "meeting time" separate from the offer's
 * own live window (offers are immediate, 5-30 minute activities, not scheduled future
 * events) — so a Selection's outcome is resolved automatically once its offer's active
 * window closes: any still-`pending` Selection becomes `happened` (FR-038: "the
 * meetup's outcome MUST resolve to either happened or cancelled" — cancellation is the
 * only other path, handled synchronously by ParticipationService.cancel). This is a
 * documented interpretation, not an explicitly stated rule — flagged for product-owner
 * confirmation alongside the other open spec questions.
 */
@Injectable()
export class EventConsumersService implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = new RedisEventBus(this.redisUrl);
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(
    private readonly prisma: PrismaService,
    private readonly participation: ParticipationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe<Record<string, unknown>>('offer.stopped', (e) =>
      this.guarded(e, () => this.onOfferEnded(e, false)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>('offer.expired', (e) =>
      this.guarded(e, () => this.onOfferEnded(e, true)),
    );
  }

  private async guarded(event: DomainEvent, handler: () => Promise<void>): Promise<void> {
    const isNew = await this.idempotency.markProcessedIfNew(CONSUMER_NAME, event.eventId);
    if (!isNew) return;
    await handler();
  }

  private async onOfferEnded(event: DomainEvent, isExpiry: boolean): Promise<void> {
    const offerId = String((event.data as Record<string, unknown>).offerId);

    const pendingSelections = await this.prisma.selection.findMany({
      where: { offerId, outcome: 'pending' },
    });
    for (const selection of pendingSelections) {
      await this.participation.resolveAsHappened(offerId, selection.id, event.correlationId);
    }

    // T075/FR-027: the "expired without selection" notice is specific to expiry, not a
    // creator's own manual stop — a creator who stops their own zero-interest offer
    // already knows its outcome.
    if (isExpiry) {
      await this.participation.notifyZeroSelectionIfApplicable(offerId, event.correlationId);
    }
  }
}
