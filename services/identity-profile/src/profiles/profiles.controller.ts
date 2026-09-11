import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}

  @Get(':userId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async get(@Param('userId') userId: string) {
    return this.service.getPublicProfile(userId);
  }
}
