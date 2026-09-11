import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InternalClients } from './internal-clients';

/**
 * T085: sends the rating follow-up exactly 2 hours after resolution — never instantly.
 * Resolves creator/recipient lazily at send time (see RatingEligibilityConsumer's doc
 * comment). "Sending" here means marking the prompt dispatched and making the
 * participants known; actual push/in-app delivery is the Notification service's job
 * (not yet built, T108) — this scheduler's role ends at making the prompt
 * send-ready, consistent with the stub pattern used elsewhere for not-yet-built
 * downstream delivery.
 */
@Injectable()
export class RatingPromptScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: InternalClients,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 5000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const due = await this.prisma.ratingPrompt.findMany({
      where: { sentAt: null, scheduledSendAt: { lte: new Date() } },
    });

    for (const prompt of due) {
      const [creatorUserId, recipientUserId] = await Promise.all([
        this.internal.getOfferCreator(prompt.offerId),
        this.internal.getSelectionRecipient(prompt.selectionId),
      ]);
      await this.prisma.ratingPrompt.update({
        where: { id: prompt.id },
        data: { creatorUserId, recipientUserId, sentAt: new Date() },
      });
    }
  }
}
