import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { VerificationService } from './verification.service';
import { AppealDto, ResolveAppealDto } from './dto';

/**
 * Manual appeal endpoint (FR-016 Clarifications): a rejected government-ID upload or a
 * disputed minor-flag can be appealed; the account stays restricted from publishing
 * until the appeal resolves.
 */
@Controller('verification/appeals')
export class AppealsController {
  constructor(private readonly verification: VerificationService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submitAppeal(@Body() dto: AppealDto, @Req() req: Request) {
    const userId = (req as any).verifiedPrincipal?.userId;
    const correlationId = (req as any).correlationId ?? 'unknown';
    return this.verification.submitAppeal(userId, dto, correlationId);
  }
}

/** T109: moderator-only appeal resolution, audit-logged. */
@Controller('internal/v1/identity-profile/appeal-decisions')
export class AppealDecisionsController {
  constructor(private readonly verification: VerificationService) {}

  @Post()
  @HttpCode(200)
  async resolve(@Body() dto: ResolveAppealDto, @Req() req: Request) {
    const actorUserId = (req as any).verifiedPrincipal?.userId;
    const correlationId = (req as any).correlationId ?? 'unknown';
    return this.verification.resolveAppeal(
      actorUserId,
      dto.verificationCaseId,
      dto.decision,
      correlationId,
    );
  }
}
