import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { buildDomainEvent } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

/**
 * Writes outbox rows within the same Prisma transaction as the domain state change
 * (constitution §5's transactional-outbox rule). The OutboxRelay (packages/ts-platform)
 * later publishes these onto the EventBus; this class never publishes directly.
 */
@Injectable()
export class IdentityEventsProducer {
  constructor(private readonly prisma: PrismaService) {}

  /** Call within the same $transaction as the CityInterest insert. */
  async cityInterestAdded(
    tx: PrismaService,
    userId: string,
    cityId: string,
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'identity.city-interest-added',
      userId,
      { userId, cityId },
      correlationId,
    );
  }

  async cityInterestRemoved(
    tx: PrismaService,
    userId: string,
    cityId: string,
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'identity.city-interest-removed',
      userId,
      { userId, cityId },
      correlationId,
    );
  }

  /** Enforcement-relevant status only — never the underlying evidence (contracts/events.md). */
  async userEligibilityChanged(
    userId: string,
    ageAssuranceStatus: string,
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      this.prisma,
      'identity.user-eligibility-changed',
      userId,
      { userId, ageAssuranceStatus, effectiveAt: new Date().toISOString() },
      correlationId,
    );
  }

  private async writeOutboxRow(
    client: PrismaService,
    eventType: string,
    aggregateId: string,
    data: Record<string, unknown>,
    correlationId: string,
  ): Promise<void> {
    const event = buildDomainEvent(
      {
        eventType,
        aggregateId,
        aggregateVersion: 1,
        correlationId,
        producedBy: 'identity-profile',
        data,
      },
      uuid,
    );
    await client.outboxEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        correlationId: event.correlationId,
        causationId: event.causationId,
        producedBy: event.producedBy,
        schemaVersion: event.schemaVersion,
        data: event.data as any,
      },
    });
  }
}
