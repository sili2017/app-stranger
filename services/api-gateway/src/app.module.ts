import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CorrelationMiddleware } from './middleware/correlation.middleware';
import { HealthController } from './health.controller';

@Module({
  imports: [RateLimitModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
