import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}
function correlation(req: Request) {
  return ((req as any).correlationId as string) ?? 'unknown';
}

/** T103. */
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(201)
  async create(@Body() dto: CreateSubscriptionDto, @Req() req: Request) {
    return this.subscriptions.create(
      principal(req),
      dto.plan,
      dto.receiptToken,
      correlation(req),
      dto.stripeSubscriptionId,
    );
  }

  @Post(':id/cancel')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  async cancel(@Param('id') id: string, @Req() req: Request) {
    return this.subscriptions.cancel(principal(req), id, correlation(req));
  }
}
