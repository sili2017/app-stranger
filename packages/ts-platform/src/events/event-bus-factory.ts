import { EventBus } from './event-bus.interface';
import { RedisEventBus } from './redis-event-bus';
import { KafkaEventBus } from './kafka-event-bus';

/**
 * Convergence T123: single point of construction for every service's EventBus, so the
 * Kafka cutover (ADQ-001, resolved) doesn't mean editing the ~13 call sites across 9
 * services that previously did `new RedisEventBus(url)` directly.
 *
 * Defaults to the Redis substitute when `EVENT_BUS_DRIVER` is unset, so importing this
 * module (e.g. in a unit test) never requires a Kafka broker. `scripts/startStop/start.sh`
 * sets `EVENT_BUS_DRIVER=kafka` + `KAFKA_BROKERS` for every service in the real local
 * stack, and the same two env vars are how a deployment target opts in (ADR-008) — the
 * Redis path stays only as a dependency-free fallback for tests and one-off scripts.
 *
 * `serviceName` becomes the Kafka consumer group id — each service's consumers must
 * be in their own group so two services subscribing to the same event type each get
 * a full copy (same-group consumers split partitions instead of both receiving every
 * message). Ignored for the Redis driver, which has no consumer-group concept.
 */
export function createEventBus(redisUrl: string, serviceName: string): EventBus {
  const driver = process.env.EVENT_BUS_DRIVER ?? 'redis';
  if (driver === 'kafka') {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',').map((b) => b.trim());
    return new KafkaEventBus(brokers, serviceName);
  }
  return new RedisEventBus(redisUrl);
}
