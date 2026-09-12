import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Convergence T130 (FR-015, Clarifications Session 2026-09-12 round 2): a resolved
 * Report is retained for 12 months after decidedAt, then anonymized (reporter identity
 * and free-text reason cleared, the case record itself kept for aggregate/audit
 * purposes) — except one under an active legal/safety hold. A still-pending_review
 * report (no decidedAt) is never touched by this timer.
 */
export const REPORT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReportRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const deadline = new Date(Date.now() - REPORT_RETENTION_MS);
    await this.prisma.report.updateMany({
      where: {
        legalHold: false,
        decidedAt: { lte: deadline },
        reporterUserId: { not: '[anonymized]' },
      },
      data: { reporterUserId: '[anonymized]', reason: null },
    });
  }
}
