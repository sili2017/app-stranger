import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DomainExceptionFilter } from '@stranger/ts-platform';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Dev-only: the Flutter Web client runs on its own dev-server origin and calls
  // each domain service directly (no gateway proxy yet, see T017-T020) — permissive
  // CORS here matches the rest of this stack's dev-only posture (devPrincipalMiddleware,
  // DevOidcIssuer) and MUST NOT be carried into production.
  app.enableCors();
  app.setGlobalPrefix('api/v1', { exclude: ['healthz'] });
  app.useGlobalFilters(new DomainExceptionFilter());
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api-gateway listening on :${port}`);
}

bootstrap();
