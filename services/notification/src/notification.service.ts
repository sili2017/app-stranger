import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * T108: every notification gets an in-app record immediately (the "in-app live feed"
 * fallback FR-006 always requires) plus one push job per registered device token,
 * dispatched by DispatchScheduler targeting the ~30-second delivery goal. A user with
 * no registered push token — push permission denied/not granted — still gets the
 * in-app record, matching FR-006's fallback rule; the persistent in-app banner/badge
 * nudging them to enable push (spec.md Clarifications, 2026-09-11) is a client concern.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(
    userId: string,
    templateKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.notificationJob.create({
      data: {
        userId,
        channel: 'in_app',
        templateKey,
        payload: payload as any,
        status: 'sent',
        sentAt: new Date(),
      },
    });

    const hasPushToken = (await this.prisma.pushToken.count({ where: { userId } })) > 0;
    if (hasPushToken) {
      await this.prisma.notificationJob.create({
        data: { userId, channel: 'push', templateKey, payload: payload as any, status: 'pending' },
      });
    }
  }

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    return this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.notificationJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
