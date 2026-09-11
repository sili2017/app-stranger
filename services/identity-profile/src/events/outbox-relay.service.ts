import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxRelay, RedisEventBus } from '@stranger/ts-platform';
import { PrismaOutboxRepository } from './prisma-outbox-repository';

/**
 * Starts the OutboxRelay so rows written by IdentityEventsProducer actually reach the
 * [BLOCKED: ADQ-001] Redis-backed EventBus stub.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly eventBus = new RedisEventBus(process.env.REDIS_URL ?? 'redis://localhost:6379');
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
