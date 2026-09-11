import { Controller, Get, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { EntitlementsService } from './entitlements.service';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}

/** T102. */
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async get(@Req() req: Request) {
    return this.entitlements.getEntitlementStatus(principal(req));
  }
}
