import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { RatingService } from './rating.service';
import { SubmitRatingDto } from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}
function correlation(req: Request) {
  return ((req as any).correlationId as string) ?? 'unknown';
}

@Controller('ratings')
export class RatingsController {
  constructor(private readonly rating: RatingService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(201)
  async submit(@Body() dto: SubmitRatingDto, @Req() req: Request) {
    return this.rating.submit(principal(req), dto, correlation(req));
  }

  @Post(':id/photo-consent')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  async consentToPhoto(@Param('id') ratingFeedbackId: string, @Req() req: Request) {
    return this.rating.consentToPhoto(principal(req), ratingFeedbackId, correlation(req));
  }
}
