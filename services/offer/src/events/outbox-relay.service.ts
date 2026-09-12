import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxRelay, createEventBus } from '@stranger/ts-platform';
import { PrismaOutboxRepository } from './prisma-outbox-repository';

/**
 * Starts the OutboxRelay (packages/ts-platform/src/outbox/) so rows written by
 * OfferEventsProducer actually reach the [BLOCKED: ADQ-001] Redis-backed EventBus stub.
 * Without this running, outbox rows would sit unpublished forever — the outbox table
 * alone isn't self-driving.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly eventBus = createEventBus(process.env.REDIS_URL ?? 'redis://localhost:6379', 'offer');
  private relay: OutboxRelay | null = null;

  constructor(private readonly repository: PrismaOutboxRepository) {}

  onModuleInit(): void {
    this.relay = new OutboxRelay(this.repository, this.eventBus);
    this.relay.start();
  }

  onModuleDestroy(): void {
    this.relay?.stop();
  }
}
