import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthorizeController } from './authorize.controller';
import { PrismaService } from './prisma.service';
import { BillingEventsProducer } from './events/billing-events.producer';
import { PrismaOutboxRepository } from './events/prisma-outbox-repository';
import { OutboxRelayService } from './events/outbox-relay.service';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [
    AuthorizeController,
    EntitlementsController,
    SubscriptionsController,
    PurchasesController,
  ],
  providers: [
    PrismaService,
    BillingEventsProducer,
    PrismaOutboxRepository,
    OutboxRelayService,
    EntitlementsService,
    SubscriptionsService,
    PurchasesService,
  ],
})
export class AppModule {}
