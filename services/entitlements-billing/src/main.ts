import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import Redis from 'ioredis';
import {
  DomainExceptionFilter,
  IdempotencyInterceptor,
  createAuthMiddleware,
} from '@stranger/ts-platform';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true keeps req.rawBody available alongside normal JSON parsing (rather
  // than a per-route body-parser override), needed only by the Stripe webhook route
  // to verify stripe.webhooks.constructEvent's signature against the exact raw bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Dev-only: the Flutter Web client runs on its own dev-server origin and calls
  // each domain service directly (no gateway proxy yet, see T017-T020) — permissive
  // CORS here matches the rest of this stack's dev-only posture (createAuthMiddleware's
  // AUTH_PROVIDER-unset fallback) and MUST NOT be carried into production.
  app.enableCors();
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(
    new IdempotencyInterceptor(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')),
  );
  // ultrareview finding: Stripe authenticates this route with its own `stripe-
  // signature` header (verified inside the controller against the raw body above),
  // never a Bearer token — it must stay reachable even under AUTH_PROVIDER=oidc, or
  // every subscription/payment webhook 401s and billing state stops syncing.
  app.use(createAuthMiddleware({ publicPaths: ['/payment-webhook/stripe'] }));
  const port = process.env.PORT ?? 3007;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`entitlements-billing listening on :${port}`);
}

bootstrap();
