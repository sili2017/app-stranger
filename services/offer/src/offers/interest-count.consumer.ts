import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventIdempotencyGuard, RedisEventBus } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

const CONSUMER_NAME = 'offer-interest-count';

/**
 * FR-042/T063 (bug fix): contracts/events.md requires Offer AND Discovery & Location to
 * each maintain their own denormalized `interestCount` for their respective offer-detail
 * and feed responses. T063 built Discovery's copy but this consumer — Offer's own copy,
 * returned by `GET /api/v1/offers/{id}` — was missing entirely, so that endpoint always
 * returned 0 regardless of real interest. Found via live quickstart verification (T111).
 */
@Injectable()
export class InterestCountConsumer implements OnModuleInit {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  private readonly eventBus = new RedisEventBus(this.redisUrl);
  private readonly idempotency = new EventIdempotencyGuard(new Redis(this.redisUrl));

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
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

  private async onInterestExpressed(event: DomainEvent): Promise<void> {
    const offerId = String((event.data as Record<string, unknown>).offerId);
    await this.prisma.meetOffer.updateMany({
      where: { id: offerId },
      data: { interestCount: { increment: 1 } },
    });
  }
}
