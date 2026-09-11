import { DomainEvent } from '../events/event-envelope';

export interface OutboxRow {
  id: string;
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId: string | null;
  producedBy: string;
  schemaVersion: number;
  data: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * Implemented per service against its own Prisma client (each service owns its own
 * OutboxEvent table — see outbox.prisma.fragment). Kept as an interface here so the
 * relay worker logic is shared without creating a cross-service Prisma dependency.
 */
export interface OutboxRepository {
  fetchUnpublished(limit: number): Promise<OutboxRow[]>;
  markPublished(id: string): Promise<void>;
}

export function outboxRowToDomainEvent(row: OutboxRow): DomainEvent {
  return {
    eventId: row.eventId,
    eventType: row.eventType,
    aggregateId: row.aggregateId,
    aggregateVersion: row.aggregateVersion,
    occurredAt: row.occurredAt.toISOString(),
    correlationId: row.correlationId,
    causationId: row.causationId,
    producedBy: row.producedBy,
    schemaVersion: row.schemaVersion,
    data: row.data,
  };
}
