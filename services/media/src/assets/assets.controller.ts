import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
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

  /** Feature 25: makes an uploaded asset (e.g. a profile photo) fetchable — no
   * ownership check beyond the existing dev-header auth, since a profile photo must be
   * viewable by users other than its owner (matches GET /profiles/:userId being
   * any-caller-readable). */
  @Get(':id/content')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async getContent(@Param('id') id: string, @Res() res: Response) {
    const { contentType, bytes } = await this.assets.getContent(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(bytes);
  }
}
