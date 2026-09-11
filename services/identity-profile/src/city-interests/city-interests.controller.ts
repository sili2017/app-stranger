import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CityInterestsService } from './city-interests.service';
import { CreateCityInterestDto } from './dto';

@Controller('city-interests')
export class CityInterestsController {
  constructor(private readonly service: CityInterestsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list(@Req() req: Request) {
    return this.service.list((req as any).verifiedPrincipal?.userId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async add(@Body() dto: CreateCityInterestDto, @Req() req: Request) {
    const userId = (req as any).verifiedPrincipal?.userId;
    const correlationId = (req as any).correlationId ?? 'unknown';
    return this.service.add(userId, dto.cityId, correlationId);
  }

  @Delete(':cityId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(@Param('cityId') cityId: string, @Req() req: Request) {
    const userId = (req as any).verifiedPrincipal?.userId;
    const correlationId = (req as any).correlationId ?? 'unknown';
    await this.service.remove(userId, cityId, correlationId);
    return { removed: true };
  }
}
