import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ModerationService } from './moderation.service';
import {
  CreateBlockDto,
  CreateReportDto,
  ModerationDecisionDto,
  ScreeningOverrideDto,
  SubmitScreeningAppealDto,
} from './dto';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}
function correlation(req: Request) {
  return ((req as any).correlationId as string) ?? 'unknown';
}

@Controller('blocks')
export class BlocksController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(201)
  async create(@Body() dto: CreateBlockDto, @Req() req: Request) {
    return this.moderation.createBlock(principal(req), dto.targetUserId);
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listMine(@Req() req: Request) {
    return this.moderation.listMyBlocks(principal(req));
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(201)
  async create(@Body() dto: CreateReportDto, @Req() req: Request) {
    return this.moderation.createReport(principal(req), dto.subjectType, dto.subjectId, dto.reason);
  }
}

/** Moderator-only in production; no role check enforced yet (ADQ-002a is open). */
@Controller('internal/v1/trust-safety/moderation-decisions')
export class ModerationDecisionsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @HttpCode(200)
  async decide(@Body() dto: ModerationDecisionDto, @Req() req: Request) {
    return this.moderation.decide(principal(req), dto, correlation(req));
  }
}

/**
 * Convergence T128 (FR-039): a creator's self-service appeal of an automated
 * screening rejection, mirroring Identity & Profile's verification appeal shape.
 */
@Controller('offers')
export class ScreeningAppealsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post(':offerId/screening-appeal')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(201)
  async submit(
    @Param('offerId') offerId: string,
    @Body() dto: SubmitScreeningAppealDto,
    @Req() req: Request,
  ) {
    return this.moderation.submitScreeningAppeal(principal(req), offerId, dto.reason);
  }
}

/** Convergence T126 (FR-015): the block-enforcement check called by Discovery & Location,
 * Participation, and Messaging before showing/allowing contact between two users. */
@Controller('internal/v1/trust-safety/blocks')
export class InternalBlocksController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('check')
  async check(@Query('userId') userId: string, @Query('otherUserId') otherUserId: string) {
    const blocked = await this.moderation.isBlocked(userId, otherUserId);
    return { blocked };
  }
}

/** T109: moderator-only override of an automated FR-039 screening decision, audit-logged. */
@Controller('internal/v1/trust-safety/screening-overrides')
export class ScreeningOverridesController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @HttpCode(200)
  async override(@Body() dto: ScreeningOverrideDto, @Req() req: Request) {
    return this.moderation.overrideScreening(
      principal(req),
      dto.offerId,
      dto.decision,
      dto.reason,
      correlation(req),
    );
  }
}
