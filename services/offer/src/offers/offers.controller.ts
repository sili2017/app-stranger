import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { OffersService } from './offers.service';
import { RebroadcastService } from './rebroadcast';
import { PublishOfferDto } from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}
function correlation(req: Request) {
  return ((req as any).correlationId as string) ?? 'unknown';
}

@Controller('offers')
export class OffersController {
  constructor(
    private readonly offers: OffersService,
    private readonly rebroadcast: RebroadcastService,
  ) {}

  /**
   * T045/T053: contracts/public/offer-service.md's worked example. Rate limit is
   * provisional (RATE_LIMIT_RULES in the gateway) pending the abuse-threshold policy —
   * see contracts/api-standards.md §Rate Limits.
   */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(201)
  async publish(@Body() dto: PublishOfferDto, @Req() req: Request) {
    return this.offers.publish(principal(req), dto, correlation(req));
  }

  @Post(':id/stop')
  @HttpCode(200)
  async stop(@Param('id') id: string, @Req() req: Request) {
    return this.offers.stop(id, principal(req), correlation(req));
  }

  /** Creator-only cleanup of a past offer — an active offer must be stopped first. */
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.offers.delete(id, principal(req));
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.offers.getById(id);
  }

  /** Creator or an accepted-Selection recipient only — see getExactPlace's own docs. */
  @Get(':id/place')
  async getExactPlace(@Param('id') id: string, @Req() req: Request) {
    return this.offers.getExactPlace(id, principal(req));
  }

  @Get()
  async listMine(@Req() req: Request) {
    return this.offers.listForCreator(principal(req));
  }

  @Get(':id/rebroadcast')
  async getRebroadcastDraft(@Param('id') id: string, @Req() req: Request) {
    return this.rebroadcast.getDraft(id, principal(req));
  }

  @Post(':id/rebroadcast')
  @HttpCode(201)
  async confirmRebroadcast(
    @Param('id') id: string,
    @Body() dto: PublishOfferDto,
    @Req() req: Request,
  ) {
    return this.rebroadcast.confirm(id, principal(req), dto, correlation(req));
  }
}
