import { Body, Controller, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { UpdateLocationDto } from './dto';

@Controller('me/location')
export class LocationController {
  constructor(private readonly prisma: PrismaService) {}

  /** T057: periodic device-GPS sample while the app is open; last_known fallback (FR-005). */
  @Put()
  async update(@Body() dto: UpdateLocationDto, @Req() req: Request) {
    const userId = (req as any).verifiedPrincipal?.userId;
    const row = await this.prisma.locationSnapshot.upsert({
      where: { userId },
      create: { userId, lat: dto.lat, lng: dto.lng, source: dto.source, capturedAt: new Date() },
      update: { lat: dto.lat, lng: dto.lng, source: dto.source, capturedAt: new Date() },
    });
    return row;
  }
}
