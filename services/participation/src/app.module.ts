import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { ParticipationEventsProducer } from './events/participation-events.producer';
import { PrismaOutboxRepository } from './events/prisma-outbox-repository';
import { OutboxRelayService } from './events/outbox-relay.service';
import { EventConsumersService } from './events/event-consumers.service';
import { InternalClients } from './internal-clients';
import { ParticipationService } from './participation.service';
import { ParticipationController, CancellationController } from './participation.controller';
import { InternalParticipationController } from './internal.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [ParticipationController, CancellationController, InternalParticipationController],
  providers: [
    PrismaService,
    ParticipationEventsProducer,
    PrismaOutboxRepository,
    OutboxRelayService,
    EventConsumersService,
    InternalClients,
    ParticipationService,
  ],
})
export class AppModule {}
