import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainExceptionFilter, IdempotencyInterceptor } from '@stranger/ts-platform';
import { AppModule } from './app.module';
import { devPrincipalMiddleware } from './dev-principal.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Dev-only: the Flutter Web client runs on its own dev-server origin and calls
  // each domain service directly (no gateway proxy yet, see T017-T020) — permissive
  // CORS here matches the rest of this stack's dev-only posture (devPrincipalMiddleware,
  // DevOidcIssuer) and MUST NOT be carried into production.
  app.enableCors();
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(
    new IdempotencyInterceptor(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')),
  );
  app.use(devPrincipalMiddleware);
  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`participation listening on :${port}`);
}

bootstrap();
