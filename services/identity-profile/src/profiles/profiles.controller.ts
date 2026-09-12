import { Body, Controller, Get, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { DomainError } from '@stranger/ts-platform';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}

  @Get(':userId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async get(@Param('userId') userId: string) {
    return this.service.getPublicProfile(userId);
  }

  @Patch(':userId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async update(
    @Param('userId') userId: string,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    const callerUserId = (req as any).verifiedPrincipal?.userId;
    if (callerUserId !== userId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.service.updateProfile(userId, dto);
  }
}
