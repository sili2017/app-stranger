import { Body, Controller, Get, HttpCode, Put, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { NotificationService } from './notification.service';
import { RegisterPushTokenDto } from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list(@Req() req: Request) {
    return this.notifications.listForUser(principal(req));
  }

  @Put('push-token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  async registerPushToken(@Body() dto: RegisterPushTokenDto, @Req() req: Request) {
    await this.notifications.registerPushToken(principal(req), dto.token, dto.platform);
    return { registered: true };
  }
}
