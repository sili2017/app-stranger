import { Injectable } from '@nestjs/common';
import { createEventBus, EventBus } from '@stranger/ts-platform';

/**
 * Bug fix: InterestCountConsumer and ModerationDecisionConsumer used to each construct
 * their own `createEventBus(url, 'offer')` — two separate Kafka consumers sharing the
 * identical groupId 'offer'. Kafka consumer-group protocol expects every member of a
 * group to have the same view of subscribed topics; two members subscribing to
 * different single topics under one group id left partition assignment undefined in
 * practice (confirmed live: one consumer got its topic's partition, the other got an
 * empty assignment and silently never processed anything — participation.interest-
 * expressed events were published but MeetOffer.interestCount never incremented).
 * kafka-event-bus.ts's own design comment already says each service should share ONE
 * EventBus instance and call subscribe() on it per event type (every other service's
 * single EventConsumersService class already does this) — this provider is that shared
 * instance for the offer service specifically.
 */
@Injectable()
export class OfferEventBus {
  readonly bus: EventBus = createEventBus(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    'offer',
  );
}
