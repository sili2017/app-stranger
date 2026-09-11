import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { buildDomainEvent } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

/**
 * Writes outbox rows within the same Prisma transaction as the MeetOffer state change
 * (constitution §5). The OutboxRelay later publishes these; this class never publishes
 * directly.
 */
@Injectable()
export class OfferEventsProducer {
  /** offer.published (T046): never the exact lat/lng — geohash only (contracts/events.md). */
  async offerPublished(
    tx: PrismaService,
    offer: {
      id: string;
      creatorUserId: string;
      cityId: string;
      placeGeohash: string;
      placeKind: string;
      activityText: string;
      lifetimeMinutes: number;
      capacity: number;
      publishedAt: Date;
      expiresAt: Date;
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'offer.published',
      offer.id,
      {
        offerId: offer.id,
        creatorUserId: offer.creatorUserId,
        cityId: offer.cityId,
        placeGeohash: offer.placeGeohash,
        placeKind: offer.placeKind,
        activityText: offer.activityText,
        lifetimeMinutes: offer.lifetimeMinutes,
        capacity: offer.capacity,
        publishedAt: offer.publishedAt.toISOString(),
        expiresAt: offer.expiresAt.toISOString(),
      },
      correlationId,
    );
  }

  async offerStoppedOrExpired(
    tx: PrismaService,
    offerId: string,
    reason: 'stopped' | 'expired',
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      reason === 'stopped' ? 'offer.stopped' : 'offer.expired',
      offerId,
      { offerId, endedAt: new Date().toISOString(), reason },
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
        producedBy: 'offer',
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
