import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { EventConsumersService } from './events/event-consumers.service';
import { EligibilityService } from './eligibility/eligibility.service';
import { LocationController } from './location/location.controller';
import { FeedController } from './feed/feed.controller';
import { InternalEligibilityController } from './eligibility/internal-eligibility.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [LocationController, FeedController, InternalEligibilityController],
  providers: [PrismaService, EventConsumersService, EligibilityService],
})
export class AppModule {}
