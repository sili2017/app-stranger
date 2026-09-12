import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AssetsService } from './assets.service';
import { UploadAssetDto } from './dto';

/** Backs Identity & Profile's profile-photo and verification (photo/government-id)
 * uploads — see that service's PublicProfile.photoAssetId / VerificationCase.
 * evidenceAssetId, which reference an asset by this id only. */
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async upload(@Body() dto: UploadAssetDto, @Req() req: Request) {
    const ownerUserId = (req as any).verifiedPrincipal?.userId ?? 'unknown';
    return this.assets.upload(ownerUserId, dto);
  }
}
