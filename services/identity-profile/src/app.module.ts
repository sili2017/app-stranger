import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { IdentityEventsProducer } from './events/identity-events.producer';
import { VerificationController } from './verification/verification.controller';
import { AppealsController, AppealDecisionsController } from './verification/appeals';
import { VerificationService } from './verification/verification.service';
import { CityInterestsController } from './city-interests/city-interests.controller';
import { CityInterestsService } from './city-interests/city-interests.service';
import { PrismaOutboxRepository } from './events/prisma-outbox-repository';
import { OutboxRelayService } from './events/outbox-relay.service';
import { RatingSummaryConsumer } from './events/rating-summary.consumer';
import { AuditLogService } from './audit/audit-log.service';
import { ProfilesController } from './profiles/profiles.controller';
import { ProfilesService } from './profiles/profiles.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [
    VerificationController,
    AppealsController,
    AppealDecisionsController,
    CityInterestsController,
    ProfilesController,
  ],
  providers: [
    PrismaService,
    IdentityEventsProducer,
    PrismaOutboxRepository,
    OutboxRelayService,
    RatingSummaryConsumer,
    AuditLogService,
    VerificationService,
    CityInterestsService,
    ProfilesService,
  ],
})
export class AppModule {}
