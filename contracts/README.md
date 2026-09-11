# Contracts

Versioned, implementation-generated contracts live here once services exist to generate them:

- `public/` — OpenAPI specs generated from each NestJS service's `@nestjs/swagger` decorators, exposed through the API Gateway (`/api/v1/...`).
- `internal/` — inter-service REST contracts (`/internal/v1/...`).
- `events/` — versioned domain-event JSON Schemas matching the envelope in `packages/ts-platform/src/events/`.

The Phase 1 design draft — the source of truth for shape and rules until each service generates its own spec — lives at [`specs/contracts/`](../specs/contracts/): `api-standards.md` (conventions), `events.md` (event catalog), and `public/offer-service.md` (worked example). Per `specs/tasks.md` T110, an automated schema-conformance test wires each generated file here back to its service's own implementation in CI.
