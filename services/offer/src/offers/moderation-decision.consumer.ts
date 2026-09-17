import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard } from '@stranger/ts-platform';
import { OffersService } from './offers.service';
import { OfferEventBus } from '../events/offer-event-bus';

const CONSUMER_NAME = 'offer-moderation-decision';

/**
 * Convergence T135 (FR-039): the "known gap" side of T094/T109's screening-override
 * endpoint — a reversed screening decision never reached Offer before this, so a
 * successful appeal (T128) had no way to actually restore the offer. Only
 * `subjectType: 'offer_screening'` decisions apply here; `decision: 'rejected'` means
 * the automated rejection itself was overturned (the offer should now go live).
 */
@Injectable()
export class ModerationDecisionConsumer implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(
    private readonly offers: OffersService,
    private readonly offerEventBus: OfferEventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.offerEventBus.bus.subscribe<Record<string, unknown>>(
      'trust.moderation-decisioned',
      (e) => this.guarded(e, () => this.onModerationDecisioned(e)),
    );
  }

  private async guarded(event: DomainEvent, handler: () => Promise<void>): Promise<void> {
    const isNew = await this.idempotency.markProcessedIfNew(CONSUMER_NAME, event.eventId);
    if (!isNew) return;
    await handler();
  }

  private async onModerationDecisioned(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    if (d.subjectType !== 'offer_screening' || d.decision !== 'rejected') return;

    const offerId = String(d.subjectId);
    await this.offers.restoreFromScreeningAppeal(offerId, event.correlationId);
  }
}
