import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PUSH_SENDER, PushSender } from './push-sender.interface';

/** T108: dispatches pending push jobs, targeting the ~30-second delivery goal (FR-006). */
@Injectable()
export class DispatchScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 3000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const pending = await this.prisma.notificationJob.findMany({
      where: { channel: 'push', status: 'pending' },
      take: 50,
    });

    for (const job of pending) {
      const tokens = await this.prisma.pushToken.findMany({ where: { userId: job.userId } });
      if (tokens.length === 0) {
        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: { status: 'failed' },
        });
        continue;
      }

      let anyDelivered = false;
      for (const token of tokens) {
        const result = await this.pushSender.send({
          token: token.token,
          templateKey: job.templateKey,
          payload: job.payload as Record<string, unknown>,
        });
        anyDelivered = anyDelivered || result.delivered;
      }

      await this.prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: anyDelivered ? 'sent' : 'failed',
          sentAt: anyDelivered ? new Date() : null,
        },
      });
    }
  }
}
