import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OfferEventsProducer } from '../events/offer-events.producer';

/**
 * Server-authoritative expiry (FR-003, FR-010): a client's local countdown is display
 * only — this scheduler is the source of truth for `active -> expired`, so a stale
 * client can never submit a new expression of interest after the real expiry.
 */
@Injectable()
export class ExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OfferEventsProducer,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 5000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const due = await this.prisma.meetOffer.findMany({
      where: { status: 'active', expiresAt: { lte: new Date() } },
      select: { id: true },
    });

    for (const { id } of due) {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.meetOffer.updateMany({
          where: { id, status: 'active' },
          data: { status: 'expired' },
        });
        // updateMany's where re-checks status == active so a concurrent stop() can't
        // race this into double-emitting offer.stopped and offer.expired for one offer.
        if (result.count > 0) {
          await this.events.offerStoppedOrExpired(
            tx as unknown as PrismaService,
            id,
            'expired',
            `expiry-scheduler-${id}`,
          );
        }
      });
    }
  }
}
