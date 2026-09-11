import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { InternalClients } from './internal-clients';
import { ChatCreationConsumer } from './chat-creation.consumer';
import { MessagingController } from './messaging.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [MessagingController],
  providers: [PrismaService, InternalClients, ChatCreationConsumer],
})
export class AppModule {}
