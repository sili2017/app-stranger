import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { OfferEventsProducer } from './events/offer-events.producer';
import { PrismaOutboxRepository } from './events/prisma-outbox-repository';
import { InternalClients } from './offers/internal-clients';
import { OffersService } from './offers/offers.service';
import { OffersController } from './offers/offers.controller';
import { InternalOffersController } from './offers/internal.controller';
import { RebroadcastService } from './offers/rebroadcast';
import { ExpiryScheduler } from './offers/expiry-scheduler';
import { OutboxRelayService } from './events/outbox-relay.service';
import { InterestCountConsumer } from './offers/interest-count.consumer';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [OffersController, InternalOffersController],
  providers: [
    PrismaService,
    OfferEventsProducer,
    PrismaOutboxRepository,
    OutboxRelayService,
    InterestCountConsumer,
    InternalClients,
    OffersService,
    RebroadcastService,
    ExpiryScheduler,
  ],
})
export class AppModule {}
