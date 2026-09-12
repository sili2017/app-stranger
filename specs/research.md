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

- **Decision**: Self-hosted Kafka, paired with the transactional-outbox pattern already mandated by constitution §5.
- **Rationale**: The platform is deliberately self-hosted (existing server, avoiding new per-service cloud spend) rather than cloud-hosted, so a managed broker's main advantage — no ops burden — comes with a recurring bill this project is specifically trying to avoid. Kafka gives the strongest ordering/replay guarantees of the options considered; idempotent consumers (already required by §5) absorb its at-least-once semantics.
- **Alternatives considered**: A managed cloud broker — rejected once the hosting model was confirmed self-hosted (no cloud billing relationship to attach it to). NATS JetStream / RabbitMQ — lighter to operate than Kafka, but Kafka's ordering/replay guarantees were judged worth the extra operational surface for a platform where event redelivery already has to be idempotency-safe regardless.
- **Status**: **RESOLVED** via `/speckit-clarify` 2026-09-12 (ADQ-001; `docs/architecture/decisions.md` ADR-008). Remaining work is the migration itself — every service's outbox-relay/consumer code currently targets the dev-only Redis-based pub/sub substitute (`packages/ts-platform/src/events/`), not Kafka.

## 6. Object storage for verification documents & media

- **Decision**: Managed cloud object storage (AWS S3, GCS, or Azure Blob — specific vendor still open), accessed only through the Media service — never directly by a client or another domain service.
- **Rationale**: Unlike compute, object storage is billed per GB and is near-zero cost at test-phase volume, so this project's usual self-hosting rationale doesn't carry the same weight here — a managed provider gives encryption-at-rest, access logging, and compliance posture "for free" that self-hosting the platform's most sensitive data category (government-ID images) would otherwise require building and auditing in-house. Funneling all access through Media keeps retention, encryption, and access-audit rules in exactly one place (matches the Media service boundary in `plan.md`).
- **Alternatives considered**: Self-hosted S3-compatible storage (MinIO) on the same server as everything else — rejected specifically for this data category despite matching the platform's general self-hosting posture, because the security/compliance tooling a managed provider gives "for free" would otherwise have to be built and audited in-house for government-ID documents. Direct client-to-storage signed uploads with no mediating service — rejected because it would let clients bypass the malware/format screening and consent/moderation handoff Media is responsible for.
- **Status**: Mechanism **RESOLVED** via `/speckit-clarify` 2026-09-12 (ADQ-005; `docs/architecture/decisions.md` ADR-010). Vendor selection, encryption/key management, retention-period values, and regional residency remain open (retention also still gated on spec Open Question 9).

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

- **Decision**: A managed OIDC-as-a-service provider (e.g. Auth0, Clerk, or AWS Cognito — specific vendor still open), owned entirely by Identity & Profile; the gateway validates the resulting access token on every request and never re-implements login itself.
- **Rationale**: This app handles age-verification and identity-document data; a managed provider's free tier covers test/beta volume at $0 while the vendor — not this team — owns session security, MFA, and social-login correctness. Self-hosting (e.g. Keycloak) would match the platform's general cost-conscious, self-hosted posture, but saves nothing until well past free-tier volume while adding real security-maintenance burden to exactly the subsystem where mistakes are costliest.
- **Alternatives considered**: Self-hosted OIDC (Keycloak) — no per-MAU cost, rejected for the reason above. Custom session-token auth — more implementation surface for equivalent guarantees, with no constitution or spec requirement favoring it.
- **Status**: Mechanism **RESOLVED** via `/speckit-clarify` 2026-09-12 (ADQ-002a; `docs/architecture/decisions.md` ADR-007). Vendor selection remains open; migrating off the current dev-only `x-dev-user-id`/`DevOidcIssuer` stand-in is unstarted implementation work, not a design decision.

## 10. Payment/subscription integration pattern

- **Decision**: Stripe, used identically for both the mobile and web clients, for the one-time-purchase and subscription entitlements — verified server-side via Stripe's webhook API by Entitlements & Billing; no card data ever reaches a Stranger service.
- **Rationale**: The browser-parity decision (`docs/architecture/decisions.md` ADR-001 amendment) means purchases must work in a desktop browser tab, where platform in-app purchase (Apple IAP / Google Play Billing) has no equivalent — the previously recommended IAP-only pattern predates that decision and cannot satisfy it. A single processor avoids maintaining separate IAP and web purchase/receipt-verification code paths; Stripe has built-in subscription, proration, and webhook support that Entitlements & Billing's existing webhook-verification structure (`payment-webhook/`) can build on directly.
- **Alternatives considered**: Platform IAP only — rejected, no web equivalent, breaks purchase parity for the browser client. Hybrid (IAP on mobile, Stripe on web) — rejected as the default; matches each platform's own convention but doubles the purchase/receipt-verification logic and reconciliation work to build and maintain for a two-platform-parity product this size.
- **Status**: Mechanism **RESOLVED** via `/speckit-clarify` 2026-09-12 (ADQ-004; `docs/architecture/decisions.md` ADR-009). Base prices, tax handling, refund exceptions, trials/promotions, and launch-region rules remain open (spec Open Questions 20-22) and are unaffected by this pattern choice. `services/entitlements-billing/src/payment-webhook/mock-payment-verifier.ts` (built against the prior Apple/Google receipt-verification assumption) is now a migration target.

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
- **Status**: Architecture decision resolved (`docs/architecture/decisions.md` ADR-001, amended). The supported-browser matrix and accessibility standard are also now resolved — see topic 14's row below (ADQ-008).

## Summary of Approvals Needed Before `/speckit-tasks`

The consolidated, cross-feature tracker for these approvals lives in `docs/architecture/decisions.md` ("Open Decisions Requiring Approval") so there is exactly one authoritative list rather than two that can drift apart (constitution §6). Map this research's topic numbers to that tracker:

| # here | Topic | Tracked as |
| --- | --- | --- |
| 5 | Durable event bus | **Resolved** — self-hosted Kafka (`/speckit-clarify` 2026-09-12, ADR-008); migration off the current dev-only pub/sub substitute is unstarted |
| 9 | Auth provider | **Resolved, vendor open** — managed OIDC-as-a-service (`/speckit-clarify` 2026-09-12, ADR-007); specific vendor still ADQ-002a |
| 6 | Object storage vendor + retention | **Resolved, vendor open** — managed cloud object storage (`/speckit-clarify` 2026-09-12, ADR-010); specific vendor + retention still ADQ-005 |
| 10 | Payment/store integration + pricing | **Resolved, pricing open** — Stripe for mobile and web (`/speckit-clarify` 2026-09-12, ADR-009); base prices/tax/trials still ADQ-004 |
| 12 | Performance targets | ADQ-007 — deferred from the 2026-09-12 clarify round, needs real traffic/business forecasts |
| 13 | Eligibility radius | **Resolved** — 5 km default, configurable per city (`/speckit-clarify`, spec.md FR-004) |
| 14 | Supported-browser matrix + web accessibility standard | **Resolved** — current-stable Chrome/Safari/Firefox/Edge, WCAG 2.1 AA (`/speckit-clarify` 2026-09-12, ADR-006 accepted) |

All other topics above (1-4, 7, 8, 11) are resolved technical decisions and are treated as final for this plan. Topic 7 (map provider) was originally flagged for approval in an earlier architecture draft; it is fully resolved by spec.md's Clarifications (FR-020) and requires no further sign-off — see `docs/architecture/decisions.md` ADQ-003. As of 2026-09-12, the only topics still genuinely open are performance/capacity targets (12, ADQ-007) and four vendor/detail picks narrower than an architecture decision (specific auth vendor, specific storage vendor, payment pricing, and ADQ-002b's ongoing age-assurance operations — the last isn't a research topic here at all, it's a product/compliance question tracked directly in `spec.md`).
