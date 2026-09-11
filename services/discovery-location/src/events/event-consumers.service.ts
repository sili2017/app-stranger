import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, RedisEventBus } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

const CONSUMER_NAME = 'discovery-location';

/**
 * Subscribes to every domain event this service's read models depend on, deduping by
 * eventId via EventIdempotencyGuard (constitution §5's idempotent-consumer rule) so a
 * redelivery from the [BLOCKED: ADQ-001] Redis stub — or its eventual managed-broker
 * replacement — is a no-op the second time.
 */
@Injectable()
export class EventConsumersService implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = new RedisEventBus(this.redisUrl);
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe<Record<string, unknown>>('offer.published', (e) =>
      this.guarded(e, () => this.onOfferPublished(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>('offer.stopped', (e) =>
      this.guarded(e, () => this.onOfferEnded(e, 'stopped')),
    );
    await this.eventBus.subscribe<Record<string, unknown>>('offer.expired', (e) =>
      this.guarded(e, () => this.onOfferEnded(e, 'expired')),
    );
    await this.eventBus.subscribe<Record<string, unknown>>('identity.city-interest-added', (e) =>
      this.guarded(e, () => this.onCityInterestAdded(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>('identity.city-interest-removed', (e) =>
      this.guarded(e, () => this.onCityInterestRemoved(e)),
    );
    await this.eventBus.subscribe<Record<string, unknown>>(
      'participation.interest-expressed',
      (e) => this.guarded(e, () => this.onInterestExpressed(e)),
    );
  }

  private async guarded(event: DomainEvent, handler: () => Promise<void>): Promise<void> {
    const isNew = await this.idempotency.markProcessedIfNew(CONSUMER_NAME, event.eventId);
    if (!isNew) return;
    await handler();
  }

  /** T059: builds the DiscoveryEligibility read model — geohash only, never exact lat/lng. */
  private async onOfferPublished(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.prisma.discoveryEligibility.upsert({
      where: { offerId: String(d.offerId) },
      create: {
        offerId: String(d.offerId),
        creatorUserId: String(d.creatorUserId),
        cityId: String(d.cityId),
        placeGeohash: String(d.placeGeohash),
        placeKind: String(d.placeKind),
        activityText: String(d.activityText),
        lifetimeMinutes: Number(d.lifetimeMinutes),
        capacity: Number(d.capacity),
        status: 'active',
        publishedAt: new Date(String(d.publishedAt)),
        expiresAt: new Date(String(d.expiresAt)),
        interestCount: 0,
      },
      update: {},
    });
  }

  private async onOfferEnded(event: DomainEvent, reason: 'stopped' | 'expired'): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.prisma.discoveryEligibility.updateMany({
      where: { offerId: String(d.offerId) },
      data: { status: reason },
    });
  }

  private async onCityInterestAdded(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.prisma.cityInterest.upsert({
      where: { userId_cityId: { userId: String(d.userId), cityId: String(d.cityId) } },
      create: { userId: String(d.userId), cityId: String(d.cityId) },
      update: {},
    });
  }

  private async onCityInterestRemoved(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.prisma.cityInterest
      .delete({
        where: { userId_cityId: { userId: String(d.userId), cityId: String(d.cityId) } },
      })
      .catch(() => undefined); // already absent — a redelivered removal is a no-op
  }

  /** T063: denormalized interestCount, never recipientUserId (FR-042, contracts/events.md). */
  private async onInterestExpressed(event: DomainEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    await this.prisma.discoveryEligibility.updateMany({
      where: { offerId: String(d.offerId) },
      data: { interestCount: { increment: 1 } },
    });
  }
}
