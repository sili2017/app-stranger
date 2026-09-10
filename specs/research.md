# Phase 0 Research: Ephemeral Stranger Meet Offers

**Input**: `spec.md`, `plan.md` Technical Context, `.specify/memory/constitution.md`.
**Scope**: Resolve the technical/architecture unknowns needed to design contracts and a data model. Product-policy unknowns (pricing, moderation SLAs, retention windows, launch countries, etc.) are NOT decided here — they stay tracked as `NEEDS CLARIFICATION` in `spec.md` and require `/speckit-clarify` + product-owner sign-off, per constitution §6 and §9.

Format per topic: Decision / Rationale / Alternatives considered.

## 1. Flutter/Dart version

- **Decision**: Latest stable Flutter release channel at implementation kickoff (currently Flutter 3.x / Dart 3.x), pinned in `pubspec.yaml` and re-pinned only via an explicit dependency-update PR.
- **Rationale**: Constitution §4 mandates Flutter/Dart; there is no product reason to pin an older channel, and a single shared codebase already needs the newest platform-integration APIs for maps/GPS/push.
- **Alternatives considered**: Pinning to the previous stable channel for "extra stability" — rejected; it would only add avoidable upgrade debt with no offsetting benefit for a greenfield project.

## 2. Node.js/TypeScript backend framework

- **Decision**: NestJS for every domain service and the API gateway.
- **Rationale**: Nine independently owned services (§5) need one consistent shape or they will drift. NestJS gives built-in dependency injection, a module system that maps cleanly to bounded contexts, first-class OpenAPI generation (`@nestjs/swagger`), and guards/interceptors that make the gateway's authN/rate-limit/telemetry responsibilities (Layer 2) straightforward to enforce consistently across services.
- **Alternatives considered**: Fastify/Express per service — rejected as the default because letting each service pick its own web framework (as flagged by the open "select libraries/frameworks rather than allowing each service to choose independently" question) reproduces exactly the inconsistency the constitution's shared-stack rule (§4) is meant to prevent. A raw Fastify gateway remains an option if NestJS's overhead proves unnecessary there; revisit only with a measured performance problem.

## 3. Schema validation & OpenAPI generation

- **Decision**: `class-validator` + `class-transformer` (NestJS's native pairing) for request/response DTO validation; `@nestjs/swagger` for OpenAPI generation from the same DTOs so the contract can never drift from the implementation.
- **Rationale**: Single source of truth for validation and documentation reduces the risk that a public contract (constitution §7: "every public API endpoint must specify request/response schemas... before client implementation") goes stale.
- **Alternatives considered**: Zod with a separate OpenAPI-generation step — viable, but adds a second schema language to keep in sync with DTOs; not justified when NestJS's native tooling already covers the requirement.

## 4. ORM / migration tooling

- **Decision**: Prisma, one schema per service (never a shared schema), with Prisma Migrate for reviewed/reversible migrations.
- **Rationale**: Matches constitution §7's requirement for "reviewed, tested, documented migrations" with a low-ceremony migration format; per-service `schema.prisma` files enforce the per-service ownership boundary (§4-5) at the tooling level, not just by convention.
- **Alternatives considered**: TypeORM — more configuration for the same guarantees; raw SQL migrations (e.g., `node-pg-migrate`) — more control but more boilerplate across nine services with no added safety.

## 5. Durable event bus

- **Decision**: A managed, cloud-provider message broker with at-least-once delivery and per-topic ordering (e.g., the managed broker of whichever cloud the platform team ultimately hosts on) is recommended over self-hosting Kafka/RabbitMQ for v1, paired with the transactional-outbox pattern already mandated by constitution §5.
- **Rationale**: Nine services and a small initial team make operating a self-hosted broker (Kafka, RabbitMQ) a disproportionate ops burden before there is real traffic. A managed broker gives at-least-once delivery and dead-lettering out of the box; idempotent consumers (already required by §5) absorb the at-least-once semantics regardless of which broker is chosen, so the choice is swappable later without a domain-model change.
- **Alternatives considered**: Self-hosted Kafka — best long-term throughput/ordering guarantees, rejected for v1 due to operational cost relative to unknown initial scale (`Scale/Scope` is itself `NEEDS CLARIFICATION`). NATS JetStream — lighter to self-host than Kafka, a reasonable second choice if the eventual hosting provider has no strong managed-broker option.
- **Status**: NEEDS APPROVAL — this is an architecture decision, not a product-policy one, but it commits to real infrastructure cost and should be confirmed by whoever owns the hosting/cloud decision before Phase 1 contracts finalize event-delivery guarantees.

## 6. Object storage for verification documents & media

- **Decision**: An S3-compatible object store (exact vendor tied to the eventual cloud/hosting choice), accessed only through the Media service — never directly by a client or another domain service.
- **Rationale**: Constitution §7 requires least-privilege, encrypted-at-rest handling for government-ID and other sensitive uploads; funneling all access through one service lets retention, encryption, and access-audit rules live in exactly one place (matches the Media service boundary in `plan.md`).
- **Alternatives considered**: Direct client-to-storage signed uploads with no mediating service — rejected because it would let clients bypass the malware/format screening and consent/moderation handoff that Media is responsible for.
- **Status**: Vendor selection and retention-period values remain open pending the hosting decision and the still-open data-retention product question (spec Open Question 9).

## 7. Map provider integration

- **Decision**: No server-side map API is required beyond geocoding/reverse-geocoding for city normalization. The client integrates the platform-default SDK directly (Apple MapKit on iOS, Google Maps SDK on Android) per FR-020's "no explicit provider choice" rule; the backend only ever stores/serves a normalized place reference (coordinates + optional label + place "kind": pin, venue, live, moving), never a provider-specific object.
- **Rationale**: Keeps Discovery & Location and Offer provider-agnostic — a future provider change is a client concern only.
- **Alternatives considered**: A unified server-side map abstraction wrapping both providers — unnecessary complexity when the platform-default rule already pins the provider per OS.

## 8. Push notifications

- **Decision**: Firebase Cloud Messaging (FCM) as the single push transport for both platforms (FCM natively supports iOS via APNs under the hood as well as Android), fronted by the Notification service.
- **Rationale**: One integration instead of two (FCM + raw APNs) simplifies the retry/idempotency logic Notification already owns, while still meeting the ~30-second delivery target in FR-006.
- **Alternatives considered**: Direct APNs + FCM integration — more control over iOS-specific payload features, not justified for v1 given no spec requirement needs APNs-only capabilities.
- **Status**: Fallback behavior when push permission is denied is still open (spec Open Question 11); the in-app live feed is already specified as the fallback channel (FR-006).

## 9. Authentication

- **Decision**: OAuth2/OIDC-based authentication (e.g., a managed identity provider or a self-hosted OIDC-compliant service) owned entirely by Identity & Profile; the gateway validates the resulting access token on every request and never re-implements login itself.
- **Rationale**: `spec.md`'s own Assumptions section states "the authentication approach has not been chosen" — this is a real gap, not an oversight, and one every other service depends on. A standard OIDC flow keeps Identity & Profile swappable (managed vs. self-hosted) without changing how every other service verifies a caller.
- **Alternatives considered**: Custom session-token auth — more implementation surface for equivalent guarantees, with no constitution or spec requirement favoring it.
- **Status**: NEEDS APPROVAL — provider choice (managed vs. self-hosted OIDC) is an architecture decision the product/engineering leads should confirm before Identity & Profile's contract is finalized.

## 10. Payment/subscription integration pattern

- **Decision**: Recommend platform in-app purchase (Apple In-App Purchase / Google Play Billing) for the mobile subscription and one-time-purchase entitlements, verified server-side via each store's receipt/webhook API by Entitlements & Billing; no card data ever reaches a Stranger service.
- **Rationale**: Both app stores require digital, in-app-consumable entitlements (exactly what a "broadcast credit" or subscription is) to go through their IAP systems — this is a platform policy constraint, not a preference. Entitlements & Billing already owns "payment-event audit" per `plan.md`, so it is the natural place to verify store receipts.
- **Alternatives considered**: A general payment processor (e.g., a card-network processor) charged directly — likely to violate app-store policy for this exact entitlement shape and was not pursued further.
- **Status**: NEEDS CLARIFICATION (product/legal) — base prices, tax handling, refund exceptions, and multi-store restore-purchase behavior remain open (spec Open Questions 19-22) and are unaffected by this pattern choice.

## 11. Testing stack

- **Decision**: `flutter_test` + `integration_test` for Dart; Jest for Node/TypeScript unit and API tests (with Supertest against each service's HTTP layer); OpenAPI-schema conformance tests (e.g., Dredd or a custom schema-diff check) for every contract in `contracts/`; Playwright for any web surface and a mobile E2E runner (Maestro or Detox) for the cross-client journeys named in `quickstart.md`.
- **Rationale**: Matches constitution §8's requirement to "run unit tests, run relevant integration tests... run E2E tests for critical journeys" with tooling that is standard for each language and requires no bespoke infrastructure.
- **Alternatives considered**: Cypress instead of Playwright — comparable; Playwright's multi-browser support and first-class TypeScript integration edge it out, but this is a low-stakes substitution either team can make later.

## 12. Provisional performance targets (pending product-owner confirmation)

Since spec.md defines only the ~30-second push-delivery target, the following are proposed *only* to make Phase 1 contract design concrete — none are binding release NFRs until confirmed:

- API read endpoints (discovery feed, offer detail): p95 < 300 ms.
- Offer publish (including the synchronous entitlement check): p95 < 500 ms end-to-end before the client sees a confirmed "active" state.
- Discovery feed refresh while an offer screen is open: client polls or subscribes at a 5-10 second interval (exact mechanism — polling vs. push-driven refresh — decided in Phase 1 contracts).
- Concurrent users, city count, and message volume: no assumption is made; the architecture (per-service scaling, managed event bus, Redis-backed hot reads) is chosen specifically so it does not require a rewrite once real numbers are supplied.

## 13. Eligibility radius — RESOLVED

- **Decision**: 5 km default, configurable per city.
- **Status**: Resolved via `/speckit-clarify` (spec.md FR-004, Clarifications "round 6") — no longer a placeholder. The data model already stores it as a per-city configurable value (`data-model.md`'s Discovery & Location section), so this confirmation required no schema change.

## 14. Flutter Web for full browser parity (v1 scope, added 2026-09-10)

- **Decision**: Ship a Flutter Web build from the same `apps/stranger_flutter/` codebase alongside the Android/iOS build, with full feature parity, per spec.md FR-041 (resolved — browser access moved into v1 scope, not a fast-follow).
- **Rationale**: A single codebase avoids the alternative of a second, separately-implemented web stack (e.g., a Bootstrap/JS SPA) that would duplicate every screen and business rule and inevitably drift from the mobile app's behavior.
- **Browser-vs-native differences requiring explicit handling** (not new architecture, just applying existing fallback rules on a new platform):
  - **Geolocation**: the browser Geolocation API typically re-prompts per session rather than granting a persistent OS-level permission; FR-005's last-known-location fallback applies identically when a browser session has no live permission yet.
  - **Push notifications**: web push support and reliability vary by browser (notably constrained on some iOS Safari configurations); FR-006's in-app/in-browser live-feed fallback is the floor guarantee on every browser regardless of push support.
  - **Media capture** (profile photo, liveness check, feedback photo): browsers use `getUserMedia`/file-input instead of a native camera API — functionally equivalent, no fallback needed, just a different Flutter plugin code path.
- **Alternatives considered**: A separate server-rendered or SPA web app (e.g., Bootstrap + a JS framework) — rejected; doubles implementation and QA effort per feature and risks UX/behavior drift from the mobile app, which a shared Flutter codebase avoids entirely.
- **Status**: Architecture decision resolved (`docs/architecture/decisions.md` ADR-001, amended). Still open: the supported-browser/version matrix and the applicable accessibility standard (ADQ-008).

## Summary of Approvals Needed Before `/speckit-tasks`

The consolidated, cross-feature tracker for these approvals lives in `docs/architecture/decisions.md` ("Open Decisions Requiring Approval") so there is exactly one authoritative list rather than two that can drift apart (constitution §6). Map this research's topic numbers to that tracker:

| # here | Topic | Tracked as |
| --- | --- | --- |
| 5 | Durable event bus vendor | ADQ-001 |
| 9 | Auth provider | ADQ-002a |
| 6 | Object storage vendor + retention | ADQ-005 |
| 10 | Payment/store integration + pricing | ADQ-004 |
| 12 | Performance targets | ADQ-007 |
| 13 | Eligibility radius | **Resolved** — 5 km default, configurable per city (`/speckit-clarify`, spec.md FR-004) |
| 14 | Supported-browser matrix + web accessibility standard | ADQ-008 |

All other topics above (1-4, 7, 8, 11, 14's Flutter-Web-as-architecture-choice itself) are resolved technical decisions and are treated as final for this plan. Topic 7 (map provider) was originally flagged for approval in an earlier architecture draft; it is fully resolved by spec.md's Clarifications (FR-020) and requires no further sign-off — see `docs/architecture/decisions.md` ADQ-003.
