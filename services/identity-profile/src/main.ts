import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainExceptionFilter, IdempotencyInterceptor, createAuthMiddleware } from '@stranger/ts-platform';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  // Items 30/33 (ultrareview finding): these are the routes a client calls to *obtain*
  // a session token in the first place — they must stay reachable with no Bearer token
  // even when this service is opted into AUTH_PROVIDER=oidc, or nobody could ever
  // register or log in again.
  app.use(
    createAuthMiddleware({
      publicPaths: [
        '/auth/register/quick',
        '/auth/register/email',
        '/auth/login/email',
        /^\/auth\/oauth\/[^/]+\/login$/,
      ],
    }),
  );
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`identity-profile listening on :${port}`);
}

bootstrap();
