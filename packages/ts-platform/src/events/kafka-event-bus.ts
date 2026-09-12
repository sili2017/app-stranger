import { Kafka, Consumer, Producer, Admin } from 'kafkajs';
import { DomainEvent } from './event-envelope';
import { EventBus, EventHandler } from './event-bus.interface';

/**
 * Convergence T123 (ADQ-001, ADR-008, resolved 2026-09-12 via /speckit-clarify):
 * self-hosted Kafka as the durable event transport, replacing RedisEventBus's dev-only
 * substitute. Every service already depends only on the EventBus interface (per T016's
 * original design), so this is a pure implementation swap — call sites change from
 * `new RedisEventBus(url)` to `new KafkaEventBus(brokers, groupId)`, nothing else.
 *
 * One event type maps to one Kafka topic (auto-created on first publish/subscribe —
 * this cluster's default `auto.create.topics.enable=true`, unchanged from Kafka's own
 * default). `groupId` should be the service's own name so each service's consumers
 * form an independent consumer group — critical, since two services both consuming
 * `offer.published` must each see every message, which only happens if they're in
 * *different* groups (same-group consumers split partitions between themselves,
 * they don't each get a full copy).
 *
 * Every service's existing consumer files call `subscribe()` multiple times in a row
 * (once per event type) inside one `onModuleInit`, each fully awaited before the next
 * starts — kafkajs requires all `consumer.subscribe()` calls to happen before
 * `consumer.run()`, so this debounces the actual `run()` call to fire once, shortly
 * after the last `subscribe()` in that sequence, rather than needing an explicit
 * "start consuming now" signal the EventBus interface has no place for.
 */
export class KafkaEventBus implements EventBus {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumer: Consumer;
  private readonly admin: Admin;
  private readonly handlers = new Map<string, EventHandler<any>[]>();
  private producerConnected = false;
  private consumerConnected = false;
  private adminConnected = false;
  private runStarted = false;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly knownTopics = new Set<string>();

  constructor(brokers: string[], groupId: string) {
    this.kafka = new Kafka({ brokers, clientId: groupId, retry: { retries: 8 } });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId });
    this.admin = this.kafka.admin();
  }

  /**
   * A consumer subscribing to a topic no producer has ever published to yet throws
   * `UNKNOWN_TOPIC_OR_PARTITION` in this cluster's configuration, even with the
   * broker's own `auto.create.topics.enable=true` (confirmed live against a real
   * KRaft-mode broker — that setting doesn't reliably cover the consumer-subscribe
   * path, only produce). Explicitly creating the topic first — on both the publish
   * and subscribe paths, so it works regardless of which side starts up first — makes
   * this reliable on a fresh cluster without depending on broker-specific behavior.
   */
  private async ensureTopic(topic: string): Promise<void> {
    if (this.knownTopics.has(topic)) return;
    if (!this.adminConnected) {
      await this.admin.connect();
      this.adminConnected = true;
    }
    try {
      await this.admin.createTopics({ topics: [{ topic, numPartitions: 1 }] });
    } catch (err) {
      // TOPIC_ALREADY_EXISTS (or a concurrent creator winning the race) is fine.
      if (!(err instanceof Error) || !err.message.includes('already exists')) throw err;
    }
    this.knownTopics.add(topic);
  }

  async publish<TData>(event: DomainEvent<TData>): Promise<void> {
    await this.ensureTopic(event.eventType);
    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
    }
    await this.producer.send({
      topic: event.eventType,
      // Partition key: same-aggregate events land on the same partition, preserving
      // per-aggregate ordering (the strongest guarantee ADQ-001 picked Kafka for).
      messages: [{ key: event.aggregateId, value: JSON.stringify(event) }],
    });
  }

  async subscribe<TData>(eventType: string, handler: EventHandler<TData>): Promise<void> {
    // Cleared synchronously, before any await below, so a timer left over from an
    // earlier subscribe() in the same onModuleInit sequence can never fire while this
    // call's own ensureTopic()/consumer.subscribe() round-trips are still in flight —
    // that race previously called consumer.run() mid-sequence, and kafkajs throws
    // "Cannot subscribe to topic while consumer is running" for every subscribe()
    // still pending after that (confirmed live: discovery-location, participation,
    // and notification's multi-topic onModuleInit sequences all hit this before the fix).
    if (this.startTimer) clearTimeout(this.startTimer);

    await this.ensureTopic(eventType);
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);

    if (!this.consumerConnected) {
      await this.consumer.connect();
      this.consumerConnected = true;
    }
    await this.consumer.subscribe({ topic: eventType, fromBeginning: false });

    this.startTimer = setTimeout(() => void this.startRun(), 50);
  }

  private async startRun(): Promise<void> {
    if (this.runStarted) return;
    this.runStarted = true;
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString()) as DomainEvent;
        const topicHandlers = this.handlers.get(topic) ?? [];
        for (const handler of topicHandlers) {
          await handler(event);
        }
      },
    });
  }

  async close(): Promise<void> {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.producerConnected) await this.producer.disconnect();
    if (this.consumerConnected) await this.consumer.disconnect();
    if (this.adminConnected) await this.admin.disconnect();
  }
}
