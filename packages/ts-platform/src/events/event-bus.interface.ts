import { DomainEvent } from './event-envelope';

export type EventHandler<TData = Record<string, unknown>> = (
  event: DomainEvent<TData>,
) => Promise<void>;

/**
 * Transport-agnostic publish/subscribe contract. Every service depends only on this
 * interface, never on a specific broker client — swapping the T016 stub for an approved
 * managed broker (ADQ-001) is then a single provider binding change, not a domain-model
 * change (constitution §5).
 */
export interface EventBus {
  publish<TData>(event: DomainEvent<TData>): Promise<void>;
  subscribe<TData>(eventType: string, handler: EventHandler<TData>): Promise<void>;
}
