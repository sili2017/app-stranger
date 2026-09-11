import Redis from 'ioredis';
import { DomainEvent } from './event-envelope';
import { EventBus, EventHandler } from './event-bus.interface';

/**
 * [BLOCKED: ADQ-001] Local stand-in for the durable event bus. Per specs/tasks.md T016,
 * every service is built against the EventBus interface only; this Redis pub/sub
 * implementation is a dev/CI substitute — it has NO delivery guarantee (no
 * dead-lettering, no replay, at-most-once on a dropped connection) and MUST NOT be used
 * in production. Swap for the approved managed-broker implementation once ADQ-001 is
 * resolved (research.md §5); no consumer code changes since they depend only on
 * EventBus, not on this class.
 */
export class RedisEventBus implements EventBus {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, EventHandler<any>[]>();

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.subscriber.on('message', (channel: string, message: string) => {
      const event = JSON.parse(message) as DomainEvent;
      const channelHandlers = this.handlers.get(channel) ?? [];
      for (const handler of channelHandlers) {
        void handler(event);
      }
    });
  }

  async publish<TData>(event: DomainEvent<TData>): Promise<void> {
    await this.publisher.publish(event.eventType, JSON.stringify(event));
  }

  async subscribe<TData>(eventType: string, handler: EventHandler<TData>): Promise<void> {
    const existing = this.handlers.get(eventType) ?? [];
    if (existing.length === 0) {
      await this.subscriber.subscribe(eventType);
    }
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
