import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { AssetsController } from './assets/assets.controller';
import { AssetsService } from './assets/assets.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [AssetsController],
  providers: [PrismaService, AssetsService],
})
export class AppModule {}
