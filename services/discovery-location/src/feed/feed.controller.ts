import { Controller, Get, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { EligibilityService } from '../eligibility/eligibility.service';
import { DistanceBand } from '../eligibility/distance';

/**
 * T064: GET /api/v1/discovery/feed — filters `activity`, `distance band`, `time
 * remaining` (FR-022, Clarifications), cursor pagination per
 * contracts/api-standards.md's `{ items, nextCursor }` shape. The candidate set behind
 * one recipient's eligibility query is bounded by their own city interests + radius, so
 * the cursor is an opaque offset over the already-computed, ranked list rather than a
 * DB-level keyset cursor.
 */
@Controller('discovery/feed')
export class FeedController {
  constructor(private readonly eligibility: EligibilityService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getFeed(
    @Req() req: Request,
    @Query('activity') activity?: string,
    @Query('distanceBand') distanceBand?: DistanceBand,
    @Query('minMinutesRemaining') minMinutesRemaining?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '20',
  ) {
    const recipientUserId = (req as any).verifiedPrincipal?.userId;
    const all = await this.eligibility.listEligibleForRecipient(recipientUserId, {
      activity,
      distanceBand,
      minMinutesRemaining: minMinutesRemaining ? Number(minMinutesRemaining) : undefined,
    });

    const offset = cursor ? Number(Buffer.from(cursor, 'base64').toString('utf8')) : 0;
    const pageSize = Math.min(Number(limit) || 20, 100);
    const page = all.slice(offset, offset + pageSize);
    const nextOffset = offset + pageSize;
    const nextCursor =
      nextOffset < all.length ? Buffer.from(String(nextOffset)).toString('base64') : null;

    return { items: page, nextCursor };
  }
}
