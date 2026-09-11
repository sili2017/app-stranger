import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, RedisEventBus } from '@stranger/ts-platform';
import { PrismaService } from './prisma.service';
import { InternalClients } from './internal-clients';

const CONSUMER_NAME = 'messaging';

/**
 * T077: consumes participation.participant-selected to create the one shared group
 * chat (creator + all selected recipients, FR-009) idempotently by selectionId — a
 * redelivered event MUST NOT create a duplicate chat or a duplicate membership row
 * (contracts/events.md's idempotency note for this event).
 *
 * Also consumes participation.selection-resolved(outcome: cancelled) to archive the
 * chat (T079, FR-038). Open design note: the spec does not explicitly define whether a
 * single recipient cancelling out of a multi-recipient group chat should archive the
 * whole chat or only remove that recipient — this implementation archives the whole
 * chat on any cancellation (the safer, conservative reading), flagged for
 * product-owner confirmation.
 */
@Injectable()
export class ChatCreationConsumer implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = new RedisEventBus(this.redisUrl);
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: InternalClients,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.participant-selected',
      (e) => this.guarded(e, () => this.onParticipantSelected(e)),
    );
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

  private async onParticipantSelected(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    const offerId = String(d.offerId);
    const recipientUserId = String(d.recipientUserId);

    const chat = await this.prisma.chat.upsert({
      where: { offerId },
      create: { offerId, status: 'active' },
      update: {},
    });

    // First membership creation for this chat also seeds the creator (fetched
    // server-side, not carried on the event — participation.participant-selected's
    // payload intentionally omits creatorUserId per contracts/events.md).
    const existingMemberships = await this.prisma.chatMembership.count({
      where: { chatId: chat.id },
    });
    if (existingMemberships === 0) {
      const creatorUserId = await this.internal.getOfferCreator(offerId);
      if (creatorUserId) {
        await this.prisma.chatMembership
          .create({ data: { chatId: chat.id, userId: creatorUserId } })
          .catch(() => undefined); // already a member — redelivery no-op
      }
    }

    await this.prisma.chatMembership
      .create({ data: { chatId: chat.id, userId: recipientUserId } })
      .catch(() => undefined); // unique(chatId, userId) — redelivery no-op
  }

  private async onSelectionResolved(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    if (d.outcome !== 'cancelled') return;

    const offerId = String(d.offerId);
    await this.prisma.chat.updateMany({
      where: { offerId },
      data: { status: 'archived_readonly' },
    });
  }
}
