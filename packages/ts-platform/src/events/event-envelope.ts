/**
 * Domain event envelope from contracts/events.md. Every service publishes and
 * consumes events in this exact shape regardless of which broker eventually
 * carries them (ADQ-001 is still open — see event-bus.interface.ts).
 */
export interface DomainEvent<TData = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string;
  correlationId: string;
  causationId: string | null;
  producedBy: string;
  schemaVersion: number;
  data: TData;
}

export interface NewDomainEventInput<TData> {
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId?: string | null;
  producedBy: string;
  schemaVersion?: number;
  data: TData;
}

export function buildDomainEvent<TData>(
  input: NewDomainEventInput<TData>,
  idGenerator: () => string,
): DomainEvent<TData> {
  return {
    eventId: idGenerator(),
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    producedBy: input.producedBy,
    schemaVersion: input.schemaVersion ?? 1,
    data: input.data,
  };
}
