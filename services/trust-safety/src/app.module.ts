import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScreeningController } from './screening/screening.controller';
import { PrismaService } from './prisma.service';
import { TrustSafetyEventsProducer } from './events/trust-safety-events.producer';
import { PrismaOutboxRepository } from './events/prisma-outbox-repository';
import { OutboxRelayService } from './events/outbox-relay.service';
import { RatingEligibilityConsumer } from './rating/rating-eligibility.consumer';
import { RatingPromptScheduler } from './rating/rating-prompt-scheduler';
import { RatingVisibilitySlaScheduler } from './rating/rating-visibility-sla-scheduler';
import { ReportRetentionScheduler } from './moderation/report-retention-scheduler';
import { InternalClients } from './rating/internal-clients';
import { RatingService } from './rating/rating.service';
import { RatingsController } from './rating/ratings.controller';
import { AuditLogService } from './audit/audit-log.service';
import { ModerationService } from './moderation/moderation.service';
import {
  BlocksController,
  ReportsController,
  ModerationDecisionsController,
  ScreeningOverridesController,
  InternalBlocksController,
  ScreeningAppealsController,
} from './moderation/moderation.controller';
import { TrustedContactsController } from './trusted-contacts/trusted-contacts.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [
    ScreeningController,
    RatingsController,
    BlocksController,
    ReportsController,
    ModerationDecisionsController,
    ScreeningOverridesController,
    InternalBlocksController,
    ScreeningAppealsController,
    TrustedContactsController,
  ],
  providers: [
    PrismaService,
    TrustSafetyEventsProducer,
    PrismaOutboxRepository,
    OutboxRelayService,
    RatingEligibilityConsumer,
    RatingPromptScheduler,
    RatingVisibilitySlaScheduler,
    ReportRetentionScheduler,
    InternalClients,
    RatingService,
    AuditLogService,
    ModerationService,
  ],
})
export class AppModule {}
