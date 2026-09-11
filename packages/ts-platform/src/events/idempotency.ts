import Redis from 'ioredis';

/**
 * Idempotent-consumer helper (constitution §5): dedupes by DomainEvent.eventId so a
 * redelivery — inherent to the at-least-once RedisEventBus stub and to whatever broker
 * eventually replaces it under ADQ-001 — is a no-op the second time. Backed by Redis SET
 * NX with a TTL so the dedupe window doesn't grow unbounded.
 */
export class EventIdempotencyGuard {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 7 * 24 * 60 * 60,
  ) {}

  /** Returns true the first time this eventId is seen for this consumer; false on redelivery. */
  async markProcessedIfNew(consumerName: string, eventId: string): Promise<boolean> {
    const key = `idempotency:${consumerName}:${eventId}`;
    const result = await this.redis.set(key, '1', 'EX', this.ttlSeconds, 'NX');
    return result === 'OK';
  }
}
