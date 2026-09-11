import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * Global default; per-route overrides come from RATE_LIMIT_RULES (rate-limit.config.ts)
 * applied via @Throttle() decorators on each service's own controllers, since the
 * gateway proxies to domain services rather than terminating every route itself.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
})
export class RateLimitModule {}
