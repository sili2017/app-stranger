import { EventBus } from '../events/event-bus.interface';
import { OutboxRepository, outboxRowToDomainEvent } from './outbox-repository.interface';

/**
 * Polls a service's own OutboxEvent table and publishes unpublished rows onto the
 * EventBus, marking each published only after a successful publish call — so a crash
 * mid-relay redelivers rather than loses the event (paired with idempotent consumers,
 * constitution §5).
 */
export class OutboxRelay {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly eventBus: EventBus,
    private readonly pollIntervalMs = 1000,
    private readonly batchSize = 50,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const rows = await this.repository.fetchUnpublished(this.batchSize);
    for (const row of rows) {
      await this.eventBus.publish(outboxRowToDomainEvent(row));
      await this.repository.markPublished(row.id);
    }
  }
}
