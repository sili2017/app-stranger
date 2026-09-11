import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { buildDomainEvent } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TrustSafetyEventsProducer {
  /** T087: fires only on a visibility transition to public, never on initial submission. */
  async ratingSubmitted(
    tx: PrismaService,
    input: {
      ratingFeedbackId: string;
      offerId: string;
      rateeUserId: string;
      starRating: number;
      visibility: 'public';
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'trust.rating-submitted',
      input.ratingFeedbackId,
      input,
      correlationId,
    );
  }

  /** T094/T109: opaque case id + routing metadata only — report/evidence content never leaves this service. */
  async moderationDecisioned(
    tx: PrismaService,
    input: {
      caseId: string;
      subjectType: 'block' | 'report' | 'offer_screening';
      subjectId: string;
      decision: 'enforced' | 'rejected' | 'appeal_upheld' | 'appeal_denied';
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'trust.moderation-decisioned',
      input.caseId,
      { ...input, decidedAt: new Date().toISOString() },
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
        producedBy: 'trust-safety',
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
