import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { PurchasesService } from './purchases.service';
import { PurchaseBroadcastDto } from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}
function correlation(req: Request) {
  return ((req as any).correlationId as string) ?? 'unknown';
}

/** T104. */
@Controller('broadcast-purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(201)
  async purchase(@Body() dto: PurchaseBroadcastDto, @Req() req: Request) {
    return this.purchases.purchase(principal(req), dto.receiptToken, correlation(req));
  }
}
