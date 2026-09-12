import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Convergence T130 (FR-038, Clarifications Session 2026-09-12 round 2): a Chat and its
 * Messages are retained for 12 months after archivedAt, then deleted — except one
 * under an active legal/safety hold, which the timer never touches.
 */
export const CHAT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class RetentionPurgeScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const deadline = new Date(Date.now() - CHAT_RETENTION_MS);
    const due = await this.prisma.chat.findMany({
      where: { status: 'archived_readonly', legalHold: false, archivedAt: { lte: deadline } },
    });

    for (const chat of due) {
      await this.prisma.message.deleteMany({ where: { chatId: chat.id } });
      await this.prisma.chatMembership.deleteMany({ where: { chatId: chat.id } });
      await this.prisma.chat.delete({ where: { id: chat.id } });
    }
  }
}
