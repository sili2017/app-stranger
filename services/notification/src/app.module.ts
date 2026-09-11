import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { InternalClients } from './internal-clients';
import { EventConsumersService } from './event-consumers.service';
import { PUSH_SENDER } from './push/push-sender.interface';
import { FcmPushSender } from './push/fcm-push-sender';
import { DispatchScheduler } from './push/dispatch-scheduler';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [NotificationsController],
  providers: [
    PrismaService,
    NotificationService,
    InternalClients,
    EventConsumersService,
    { provide: PUSH_SENDER, useClass: FcmPushSender },
    DispatchScheduler,
  ],
})
export class AppModule {}
