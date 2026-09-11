import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { buildDomainEvent } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ParticipationEventsProducer {
  /** T072: fires on every accepted expression of interest (FR-042's +1 count signal). */
  async interestExpressed(
    tx: PrismaService,
    input: {
      offerId: string;
      expressionOfInterestId: string;
      recipientUserId: string;
      hasMessage: boolean;
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'participation.interest-expressed',
      input.offerId,
      input,
      correlationId,
    );
  }

  /** T074: triggers Messaging's shared group chat creation (FR-009). */
  async participantSelected(
    tx: PrismaService,
    input: {
      offerId: string;
      selectionId: string;
      expressionOfInterestId: string;
      recipientUserId: string;
      selectedAt: Date;
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'participation.participant-selected',
      input.offerId,
      { ...input, selectedAt: input.selectedAt.toISOString() },
      correlationId,
    );
  }

  /** T080: outcome resolves to happened|cancelled — Trust & Safety's rating eligibility trigger. */
  async selectionResolved(
    tx: PrismaService,
    input: {
      offerId: string;
      selectionId: string;
      outcome: 'happened' | 'cancelled';
      cancelledBy: 'creator' | 'recipient' | null;
      resolvedAt: Date;
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'participation.selection-resolved',
      input.offerId,
      { ...input, resolvedAt: input.resolvedAt.toISOString() },
      correlationId,
    );
  }

  /**
   * FR-027 (T075/T108): tells every interested recipient the offer expired without
   * selection. Not part of the original contracts/events.md catalog — added because
   * Notification (T108) needs a concrete event to dispatch this notice from, and no
   * other event in the catalog carries the full interested-recipient list.
   */
  async offerExpiredWithoutSelection(
    tx: PrismaService,
    offerId: string,
    recipientUserIds: string[],
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'participation.offer-expired-without-selection',
      offerId,
      { offerId, recipientUserIds },
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
        producedBy: 'participation',
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
