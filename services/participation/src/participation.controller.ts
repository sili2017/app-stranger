import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ParticipationService } from './participation.service';
import { ExpressInterestDto, SelectRecipientDto } from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}
function correlation(req: Request) {
  return ((req as any).correlationId as string) ?? 'unknown';
}

@Controller('offers/:offerId')
export class ParticipationController {
  constructor(private readonly participation: ParticipationService) {}

  /** T071: contracts/public/offer-service.md's express-interest endpoint. */
  @Post('expressions-of-interest')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(201)
  async expressInterest(
    @Param('offerId') offerId: string,
    @Body() dto: ExpressInterestDto,
    @Req() req: Request,
  ) {
    return this.participation.expressInterest(
      offerId,
      principal(req),
      dto.message,
      correlation(req),
    );
  }

  /** Creator-only: list expressions of interest so the creator can choose one to select. */
  @Get('expressions-of-interest')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listExpressionsOfInterest(@Param('offerId') offerId: string, @Req() req: Request) {
    return this.participation.listExpressionsOfInterest(offerId, principal(req));
  }

  /** Creator sees every selection on the offer; a recipient sees only their own. */
  @Get('selections/mine')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listSelectionsVisibleToMe(@Param('offerId') offerId: string, @Req() req: Request) {
    return this.participation.listSelectionsVisibleTo(offerId, principal(req));
  }

  /** T073: creator-only selection. */
  @Post('selections')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(201)
  async select(
    @Param('offerId') offerId: string,
    @Body() dto: SelectRecipientDto,
    @Req() req: Request,
  ) {
    return this.participation.select(
      offerId,
      principal(req),
      dto.expressionOfInterestId,
      correlation(req),
    );
  }
}

/** T079: either party (or a creator revocation, treated identically) can cancel. */
@Controller('offers/:offerId/selections/:selectionId')
export class CancellationController {
  constructor(private readonly participation: ParticipationService) {}

  @Post('cancel')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  async cancel(
    @Param('offerId') offerId: string,
    @Param('selectionId') selectionId: string,
    @Req() req: Request,
  ) {
    return this.participation.cancel(offerId, selectionId, principal(req), correlation(req));
  }
}
