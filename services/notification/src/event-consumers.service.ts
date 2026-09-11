import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, RedisEventBus } from '@stranger/ts-platform';
import { NotificationService } from './notification.service';
import { InternalClients } from './internal-clients';

const CONSUMER_NAME = 'notification';

/**
 * T108: dispatches notifications for the events that already carry (or can cheaply
 * resolve) a concrete recipient. **Known gap**: this does NOT include "a new offer was
 * published near you" — proactively fanning that out to every eligible recipient within
 * ~30 seconds (FR-006) requires a background job that scans Discovery & Location's
 * eligibility read model on every offer.published event, which is not built. Recipients
 * currently only see a new offer by pulling `GET /discovery/feed` themselves.
 */
@Injectable()
export class EventConsumersService implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = new RedisEventBus(this.redisUrl);
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(
    private readonly notifications: NotificationService,
    private readonly internal: InternalClients,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.interest-expressed',
      (e) => this.guarded(e, () => this.onInterestExpressed(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.participant-selected',
      (e) => this.guarded(e, () => this.onParticipantSelected(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.selection-resolved',
      (e) => this.guarded(e, () => this.onSelectionResolved(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.offer-expired-without-selection',
      (e) => this.guarded(e, () => this.onOfferExpiredWithoutSelection(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>('billing.subscription-changed', (e) =>
      this.guarded(e, () => this.onSubscriptionChanged(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>(
      'billing.one-time-broadcast-granted',
      (e) => this.guarded(e, () => this.onOneTimeBroadcastGranted(e)),
    );
  }

  private async guarded(event: DomainEvent, handler: () => Promise<void>): Promise<void> {
    const isNew = await this.idempotency.markProcessedIfNew(CONSUMER_NAME, event.eventId);
    if (!isNew) return;
    await handler();
  }

  /** Alerts the creator that someone expressed interest. */
  private async onInterestExpressed(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    const offerId = String(d.offerId);
    const creatorUserId = await this.internal.getOfferCreator(offerId);
    if (!creatorUserId) return;
    await this.notifications.queue(creatorUserId, 'participation.interest-expressed', {
      offerId,
      hasMessage: d.hasMessage,
    });
  }

  /** Informs creator + selected recipient (FR-009's chat-ready moment). */
  private async onParticipantSelected(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    const offerId = String(d.offerId);
    const recipientUserId = String(d.recipientUserId);
    const creatorUserId = await this.internal.getOfferCreator(offerId);

    await this.notifications.queue(recipientUserId, 'participation.participant-selected', {
      offerId,
    });
    if (creatorUserId) {
      await this.notifications.queue(creatorUserId, 'participation.participant-selected', {
        offerId,
      });
    }
  }

  /** T079/FR-038: informs the other party of a cancellation. */
  private async onSelectionResolved(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    if (d.outcome !== 'cancelled') return;

    const offerId = String(d.offerId);
    const selectionId = String(d.selectionId);
    const [creatorUserId, recipientUserId] = await Promise.all([
      this.internal.getOfferCreator(offerId),
      this.internal.getSelectionRecipient(selectionId),
    ]);
    if (!creatorUserId || !recipientUserId) return;

    const cancelledBy = d.cancelledBy; // 'creator' | 'recipient'
    const otherParty = cancelledBy === 'creator' ? recipientUserId : creatorUserId;
    await this.notifications.queue(otherParty, 'participation.selection-cancelled', {
      offerId,
      selectionId,
    });
  }

  /** FR-027: tells every interested recipient the offer expired without selection. */
  private async onOfferExpiredWithoutSelection(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    const offerId = String(d.offerId);
    const recipientUserIds = (d.recipientUserIds as string[]) ?? [];
    for (const recipientUserId of recipientUserIds) {
      await this.notifications.queue(recipientUserId, 'offer.expired-without-selection', {
        offerId,
      });
    }
  }

  private async onSubscriptionChanged(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.notifications.queue(String(d.userId), 'billing.subscription-changed', d);
  }

  private async onOneTimeBroadcastGranted(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.notifications.queue(String(d.userId), 'billing.one-time-broadcast-granted', d);
  }
}
