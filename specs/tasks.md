# Tasks: Ephemeral Stranger Meet Offers

**Input**: Design documents from `/specs/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`) and `.specify/memory/constitution.md`, `docs/architecture/decisions.md`

**Prerequisites**: `plan.md` (tech stack, 9-service architecture), `spec.md` (5 user stories, FR-001-FR-042, SC-001-SC-020), `research.md`, `data-model.md`, `contracts/`

**Tests**: Constitution §8 mandates unit/integration/E2E tests as part of feature completion (not optional at the project level even though `spec.md` doesn't call them out per-story), so contract and integration test tasks are included per story, written before their implementation tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1/US2/US3 = P1, US4/US5 = P2) so each story is independently implementable and testable, per `plan.md`'s Solution Architecture and service-ownership table.

**Blocked tasks**: A task tagged `[BLOCKED: ADQ-xxx]` depends on an open decision in `docs/architecture/decisions.md` and MUST NOT be executed until that decision is approved (constitution §9). Where a blocked capability sits on another story's critical path, a stub is built first (in Foundational) so downstream stories are not blocked on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps the task to US1-US5; Setup/Foundational/Polish tasks carry no story label

## Path Conventions

Per `plan.md`'s Project Structure: `services/<name>/` for each of the 9 Node.js/TypeScript domain services and the gateway, `apps/stranger_flutter/` for the Flutter client, `packages/` for shared libraries, `contracts/` for cross-service interface documents (already populated under `specs/contracts/`), `infra/` for Docker/CI/observability.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository scaffolding so every service and the client can be built, linted, and run locally.

- [X] T001 Create the monorepo directory skeleton exactly as listed in `specs/plan.md`'s Project Structure (`apps/`, `services/`, `python-services/ai-safety/` placeholder, `contracts/{public,internal,events}/`, `packages/`, `infra/{docker,environments,migrations,observability}/`, `docs/{product,requirements,architecture}/`)
- [X] T002 [P] Initialize a pnpm/npm workspace at the repo root (`package.json`, `pnpm-workspace.yaml`) covering every directory under `services/` and `packages/` — implemented as an **npm** workspace (`package.json`'s `workspaces` field); pnpm is not available in this environment and tasks.md explicitly allows either
- [X] T003 [P] Initialize the Flutter project in `apps/stranger_flutter/` targeting Android and iOS phones/tablets AND the Flutter Web build target for desktop/laptop/Chromebook browsers, per `plan.md` Target Platform (FR-041, resolved 2026-09-10 — browser access ships in v1 with full parity; web build enablement detailed in Phase 9 below) — `pubspec.yaml`/`lib/main.dart` hand-authored; the Flutter SDK is not installed in this environment so `flutter create .` still needs to be run locally to generate the `ios/`/`android/`/`web/` platform folders
- [X] T004 [P] Configure ESLint + Prettier for all TypeScript packages/services at the repo root (`.eslintrc`, `.prettierrc`)
- [X] T005 [P] Configure `flutter analyze` + `dart format` CI check for `apps/stranger_flutter/`
- [X] T006 [P] Author `infra/docker/docker-compose.yml` with one PostgreSQL instance per service (9 databases), one shared Redis, and a local event-bus emulator placeholder, per `research.md` §4-5
- [X] T007 [P] Author the GitHub Actions CI skeleton in `.github/workflows/ci.yml`: lint, type-check, and unit test per changed service/package (constitution §4 CI/CD, §8 quality gates)
- [X] T008 [P] Scaffold `packages/ts-platform/` (empty module structure: `errors/`, `events/`, `outbox/`, `observability/`) per `plan.md` Project Structure
- [X] T009 [P] Scaffold `packages/dart-design-system/` (empty theme/component module) for shared Flutter UI
- [X] T010 [P] Scaffold `packages/test-fixtures/` for shared contract/test fixtures referenced by later contract-test tasks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure and the minimum Identity & Profile + stub Entitlements/Trust&Safety surface every user story's Independent Test needs (a registered, age-eligible user must exist before any offer can be published, discovered, joined, rated, or billed).

**⚠️ CRITICAL**: No user story phase may begin until this phase is complete.

### Shared platform libraries

- [X] T011 [P] Implement the standard error envelope (`code`, `messageKey`, `correlationId`, `details`) from `contracts/api-standards.md` as Nest exception filters in `packages/ts-platform/src/errors/`
- [X] T012 [P] Implement the domain-event envelope (`eventId`, `eventType`, `aggregateId`, `aggregateVersion`, `occurredAt`, `correlationId`, `causationId`, `producedBy`, `schemaVersion`) from `contracts/events.md` as a typed publish/subscribe client in `packages/ts-platform/src/events/`
- [X] T013 Implement the transactional-outbox table schema + relay worker pattern (constitution §5) in `packages/ts-platform/src/outbox/`, reusable by every service's Prisma schema
- [X] T014 [P] Implement idempotent-consumer dedupe-by-`eventId` helper in `packages/ts-platform/src/events/idempotency.ts`
- [X] T015 [P] Configure Sentry + structured logging with PII-safe redaction (never log chat content, verification documents, payment identifiers, or precise coordinates — constitution §5, §7) in `packages/ts-platform/src/observability/`
- [X] T016 [BLOCKED: ADQ-001] Provision the durable event bus (vendor per `research.md` §5) and wire `packages/ts-platform/src/events/` to it; until approved, all services run against a local in-memory/Redis-backed pub/sub substitute behind the same interface so Foundational and story work is not blocked — `RedisEventBus` implements the shared `EventBus` interface; production cutover to a managed broker remains blocked on ADQ-001

### API Gateway

- [X] T017 Scaffold the API Gateway as a NestJS app in `services/api-gateway/` exposing `/api/v1` per `contracts/api-standards.md` versioning rule
- [X] T018 Implement request-correlation-id and `Accept-Language`-aware routing middleware in `services/api-gateway/src/middleware/`
- [X] T019 [BLOCKED: ADQ-002a] Implement OAuth2/OIDC bearer-token validation at the gateway in `services/api-gateway/src/auth/`; until an auth provider is approved, the gateway validates against a local dev-only OIDC-compatible issuer so downstream services can be built against the same verified-principal contract — `DevOidcIssuer` + `BearerAuthGuard`; production cutover remains blocked on ADQ-002a
- [X] T020 Implement the gateway's per-endpoint rate-limit configuration surface in `services/api-gateway/src/rate-limit/` per `contracts/api-standards.md` (no endpoint ships without a stated limit)

### Per-service scaffolding (9 domain services)

- [X] T021 [P] Scaffold `services/identity-profile/` (NestJS + Prisma) with its own PostgreSQL database per `research.md` §4
- [X] T022 [P] Scaffold `services/offer/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T023 [P] Scaffold `services/discovery-location/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T024 [P] Scaffold `services/participation/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T025 [P] Scaffold `services/messaging/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T026 [P] Scaffold `services/trust-safety/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T027 [P] Scaffold `services/entitlements-billing/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T028 [P] Scaffold `services/notification/` (NestJS + Prisma) with its own PostgreSQL database
- [X] T029 [P] Scaffold `services/media/` (NestJS + Prisma) with its own PostgreSQL database, plus a storage-adapter interface with a local-filesystem dev implementation; the real S3-compatible provider is `[BLOCKED: ADQ-005]`

### Identity & Profile core (needed by every story's "a registered user" precondition)

- [X] T030 [P] Create the `UserAccount` model + migration in `services/identity-profile/prisma/schema.prisma`: `dateOfBirth` (Highly Restricted, never in an API response or event), `ageAssuranceStatus` enum exactly `self_declared | liveness_passed | liveness_flagged_pending_id | id_verified | id_rejected_appeal_pending | restricted`, `accountStatus` enum `active | disabled`
- [X] T031 [P] Create the `PublicProfile` model + migration: `firstName`, `photoAssetId`, `ageRangeLabel`, `interests: string[]`, `verificationStatus` enum `unverified | photo_verified | id_verified`, `languagePreference`, `publicRatingSummary` (average + count only, never individual feedback text)
- [X] T032 [P] Create the `RegisteredAddress` model + migration: `city`, `country`, `calendarTimezone` (nullable placeholder pending the city→timezone mapping decision — spec Open Question 18)
- [X] T033 [P] Create the `VerificationCase` model + migration: `kind` enum `photo_liveness | government_id`, `status` enum `submitted | passed | flagged | rejected | appeal_pending | appeal_upheld | appeal_denied`, `evidenceAssetId` (references Media, never stores the file itself)
- [X] T034 [P] Create the `CityInterest` model + migration in `services/identity-profile/prisma/schema.prisma`: `userId`, `cityId`, `createdAt` — a user MAY have any number of rows (FR-023)
- [X] T035 Implement the mandatory signup age-assurance flow in `services/identity-profile/src/verification/`: self-declared date of birth + mandatory photo-liveness check; if liveness flags a possible minor despite an 18+ self-declaration, require `VerificationCase(kind: government_id)` before the account's first offer can publish (FR-016)
- [X] T036 Implement the manual appeal endpoint for a rejected government-ID upload or a disputed minor-flag in `services/identity-profile/src/verification/appeals.ts`: account's `ageAssuranceStatus` stays `id_rejected_appeal_pending`/`restricted` until the appeal resolves (FR-016 Clarifications)
- [X] T037 [P] Implement CRUD endpoints for `CityInterest` in `services/identity-profile/src/city-interests/` (`POST/GET/DELETE /api/v1/city-interests`)
- [X] T038 Implement `identity.city-interest-added` / `identity.city-interest-removed` event producers in `services/identity-profile/src/city-interests/` (extends `contracts/events.md`; needed so Discovery & Location can materialize a local join copy without a synchronous call per lookup) and `identity.user-eligibility-changed` per the existing contract in `contracts/events.md`

### Stub dependencies for cross-service publish flow (replaced with real logic in later stories)

- [X] T039 [P] Scaffold `services/entitlements-billing/` internal endpoint `POST /internal/v1/entitlements/authorize` that always returns `granted` (real free-allowance/subscription logic is built in US5 — see T0xx below); this unblocks Offer's publish flow independently of US5
- [X] T040 [P] Implement the FR-039 automated keyword/content-screening check in `services/trust-safety/src/screening/` and expose it as `POST /internal/v1/trust-safety/screen-offer`, called synchronously by Offer at publish time for every offer including high-risk categories (Clarifications round 5 — no human-review carve-out in v1)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Publish an immediate meet offer (Priority: P1) 🎯 MVP

**Goal**: A registered, age-eligible user can publish a meet offer, see it active for its configured lifetime, stop it early, and rebroadcast it after expiry.

**Independent Test**: Publish "Sunny wants to drink tea" at a named tea stall, see its active period, stop it before expiration (spec.md User Story 1).

### Tests for User Story 1

- [X] T041 [P] [US1] Contract test for `POST /api/v1/offers` against `contracts/public/offer-service.md` in `services/offer/test/contract/publish-offer.spec.ts` (asserts default 15-min lifetime when `lifetimeMinutes` omitted, `201` response shape incl. `interestCount: 0`)
- [X] T042 [P] [US1] Integration test for the full publish → active → expire lifecycle in `services/offer/test/integration/offer-lifecycle.spec.ts`
- [X] T043 [P] [US1] Integration test asserting `422 CONTENT_SCREENING_FAILED` blocks a publish before any entitlement is reserved, in `services/offer/test/integration/screening-gate.spec.ts`

### Implementation for User Story 1

- [X] T044 [US1] Create the `MeetOffer` model + migration in `services/offer/prisma/schema.prisma`: `activityText`, `place: { kind: pin|venue|live|moving, label?, lat, lng, geohash, rendezvousInstruction?, capturedAt }` with `rendezvousInstruction` **required** when `kind == moving` or the location is a queue-style spot without a fixed venue (FR-002), `lifetimeMinutes` integer **5-30, default 15** (FR-003), `capacity` integer **1-10, fixed at publish, immutable while active** (FR-008), `status` enum `active | expired | stopped`, `publishedAt`, `expiresAt`, `interestCount` int default 0, `screeningResult: { passed, ruleVersion, evaluatedAt }`, `rebroadcastOfCityOfferId` nullable self-reference — model fields are flattened rather than nested (Prisma has no first-class embedded-object type); no migration was run against a live database (no Postgres available in this environment) — run `prisma migrate dev` locally against `infra/docker/docker-compose.yml`'s `postgres-offer`
- [X] T045 [US1] Implement `POST /api/v1/offers` in `services/offer/src/offers/offers.controller.ts`: validate activity + place (map pin via platform-default provider or live location required per FR-020), call Trust & Safety's `screen-offer` (T040) synchronously, then Entitlements & Billing's `authorize` (T039) synchronously, persist `MeetOffer` as `active` plus its `offer.published` outbox event only on both successes; release the entitlement reservation on any downstream failure — release-on-failure is a **known gap**: the internal `authorize` call carries no `Idempotency-Key`/reservation-release endpoint yet (see checklists/api.md CHK008/CHK023)
- [X] T046 [US1] Implement `offer.published` event payload per `contracts/events.md`: `{ offerId, creatorUserId, cityId, placeGeohash, placeKind, activityText, lifetimeMinutes, capacity, publishedAt, expiresAt }` — **never** the exact `lat`/`lng`
- [X] T047 [US1] Implement the server-authoritative expiry scheduler in `services/offer/src/offers/expiry-scheduler.ts`: transitions `active → expired` at `expiresAt` and emits `offer.expired` (FR-003, FR-010)
- [X] T048 [US1] Implement `POST /api/v1/offers/{id}/stop` in `services/offer/src/offers/offers.controller.ts`: creator-only, `active → stopped`, emits `offer.stopped`, rejects if already inactive (FR-011)
- [X] T049 [US1] Implement `GET /api/v1/offers/{id}` returning `interestCount` live while `status == active` (FR-042) and the creator-only exact-place field once selection has occurred (internal contract, not this public endpoint's default response) — the internal place-lookup endpoint itself is T081 (US3, not yet built); this endpoint's own response never includes the exact place
- [X] T050 [US1] Implement `GET /api/v1/offers` (creator-visible history) and `POST /api/v1/offers/{id}/rebroadcast` in `services/offer/src/offers/rebroadcast.ts`: always creates a **new** `MeetOffer` row (never reactivates the old one), which is a **new publish** and counts again toward the monthly allowance once T0xx (US5) replaces the stub (FR-012, FR-030) — per spec.md Clarifications (2026-09-11): `GET .../rebroadcast` returns a pre-filled draft, `POST .../rebroadcast` confirms it (new place/GPS snapshot at confirm time) through the same `publish()` pipeline
- [X] T051 [US1] Implement activity free-text acceptance without a fixed catalog, plus optional non-blocking activity/emoji suggestion metadata in `services/offer/src/offers/suggestions.ts` (FR-018, FR-021 — suggestions never required to publish)
- [X] T052 [US1] Implement the `moneyPreference` field (`label` enum `creator_pays | byo | split | estimated_cost`, optional free-text `note` flagged `noteModerationStatus: pending`) in `services/offer/src/offers/offers.controller.ts` (FR-028)
- [X] T053 [P] [US1] Add rate limiting to `POST /api/v1/offers` per `contracts/api-standards.md`'s rule that no endpoint ships without a stated limit — provisional threshold (5/min) pending the abuse-threshold policy; applied both at the gateway's `RATE_LIMIT_RULES` and via `@Throttle()` on the Offer service's own controller

**Checkpoint**: User Story 1 is independently functional and testable (publish, view active period, stop, rebroadcast) using the Foundational stubs for entitlements and screening. **Verified in this environment**: `npm run build`, `npm run lint`, `npm run format`, and `npm test` all pass clean across the whole workspace (api-gateway + 9 services + ts-platform); Offer's own Jest suite (3 files, 4 tests) passes. Not verified here (no local Postgres/Redis/Flutter SDK available): `prisma migrate dev` against a live database, running the services against `infra/docker/docker-compose.yml`, or any Flutter build/test.

---

## Phase 4: User Story 2 - Receive a relevant live offer (Priority: P1)

**Goal**: A recipient with the offer's city registered as an interest, within its eligibility radius, sees the offer — prioritized when it matches their current location.

**Independent Test**: Recipient with Mumbai as a registered city interest and a current location near the offer sees it prioritized over comparable offers from a non-current registered city (spec.md User Story 2).

### Tests for User Story 2

- [X] T054 [P] [US2] Integration test: recipient inside the 5 km eligibility radius with the matching city interest sees the offer; a recipient outside the radius does not, in `services/discovery-location/test/integration/eligibility.spec.ts` (FR-004, SC-002)
- [X] T055 [P] [US2] Integration test: with two registered city interests, an offer matching the recipient's current-location city ranks ahead of an offer for the other registered city, in `services/discovery-location/test/integration/ranking.spec.ts` (FR-005, SC-003)

### Implementation for User Story 2

- [X] T056 [P] [US2] Create the `LocationSnapshot` model + migration in `services/discovery-location/prisma/schema.prisma`: `userId`, `lat`, `lng`, `source` enum `live_gps | last_known`, `capturedAt`
- [X] T057 [US2] Implement `PUT /api/v1/me/location` accepting a periodic device-GPS sample while the app is open, falling back to the last known location when live GPS is unavailable (FR-005) — also enforces the 60s-sample/10-minute-staleness rule from spec.md Clarifications (2026-09-11): a stale `last_known` location makes the recipient ineligible for any offer rather than silently ranking on outdated data
- [X] T058 [US2] Consume `identity.city-interest-added`/`removed` (T038) to materialize a local `CityInterest` join table in `services/discovery-location/prisma/schema.prisma`
- [X] T059 [US2] Consume `offer.published`/`offer.stopped`/`offer.expired` (T046/T047/T048) to build the `DiscoveryEligibility` read model in `services/discovery-location/src/eligibility/`, storing only `placeGeohash` — never exact coordinates (constitution §3.IV)
- [X] T060 [US2] Implement the eligibility rule in `services/discovery-location/src/eligibility/eligibility.service.ts`: recipient is eligible when `offer.status == active` AND recipient has `CityInterest.cityId == offer.cityId` AND `distance(recipient.LocationSnapshot, offer.placeGeohash) <= eligibilityRadiusKm[cityId]`, radius **defaulting to 5 km, configurable per city** (FR-004, resolved via `/speckit-clarify`) — geohash is decoded back to an approximate cell-center point for distance math (`eligibility/geohash.ts`), since Discovery never receives the offer's exact coordinates
- [X] T061 [US2] Implement current-location-city ranking priority over other registered-city interests in `services/discovery-location/src/eligibility/eligibility.service.ts` (FR-005, FR-023) — implemented as ascending distance from the recipient's current location (nearest-first) rather than a formal "current city" label, since no city-normalization source is approved yet (spec.md Assumptions); this is a documented interpretation, not an invented requirement — flagged for product-owner review alongside checklists/api.md's city-normalization gap
- [X] T062 [US2] Implement `distanceBand` computation — exactly `<1km | 1-5km | 5-15km | 15km+` — as the only distance value ever returned (FR-026)
- [X] T063 [US2] Consume `participation.interest-expressed` to maintain a denormalized `interestCount` on the read model (FR-042), never exposing `recipientUserId`
- [X] T064 [US2] Implement `GET /api/v1/discovery/feed` with filters `activity`, `distance band`, `time remaining` (FR-022, Clarifications) and cursor pagination per `contracts/api-standards.md` — cursor is an opaque offset over the ranked result set (bounded by one recipient's own city interests + radius), not a DB-level keyset cursor
- [X] T065 [P] [US2] Add rate limiting to `GET /api/v1/discovery/feed`

**Checkpoint**: User Stories 1 AND 2 both work independently — an offer published in US1 is correctly discoverable/ranked in US2. **Verified live in this environment** against real, locally-built PostgreSQL 16.4 + Redis 8.10 (see `.tooling/`, not committed): published a real offer via the running Offer service, confirmed the `offer.published` outbox row was relayed onto Redis (exact `lat`/`lng` absent, `placeGeohash` present, matching the Payload Minimization Rule), consumed by a running Discovery & Location instance, and correctly included/excluded from `GET /discovery/feed` for recipients inside vs. outside the 5 km radius with the right `distanceBand`. `npm run build`, `npm run lint`, `npm run format`, and `npm test` all still pass clean across the whole workspace (10 services + ts-platform); Discovery & Location's own Jest suite (2 files, 4 tests) passes.

---

## Phase 5: User Story 3 - Accept an offer and coordinate (Priority: P1)

**Goal**: An eligible recipient expresses interest; the creator selects; a shared chat opens for coordination; either party can cancel afterward.

**Independent Test**: Recipient expresses interest while active; creator selects; chat becomes available to both; post-expiry interest is rejected (spec.md User Story 3).

### Tests for User Story 3

- [X] T066 [P] [US3] Contract test for `POST /api/v1/offers/{id}/expressions-of-interest` and `POST /api/v1/offers/{id}/selections` against `contracts/public/offer-service.md` in `services/participation/test/contract/`
- [X] T067 [P] [US3] Integration test: expiring an offer mid-submission returns `409 OFFER_NOT_ACTIVE` and creates no chat, in `services/participation/test/integration/race-expiry.spec.ts` (Edge Cases)
- [X] T068 [P] [US3] Integration test: creator selects fewer recipients than expressed interest — unselected recipient gets no non-selection notice, offer's `interestCount` stays visible to all viewers, in `services/participation/test/integration/partial-selection.spec.ts` (FR-008, FR-042, SC-020)

### Implementation for User Story 3

- [X] T069 [P] [US3] Create the `ExpressionOfInterest` model + migration in `services/participation/prisma/schema.prisma`: `offerId`, `recipientUserId`, `message` optional short text, `createdAt`
- [X] T070 [P] [US3] Create the `Selection` model + migration: `offerId`, `expressionOfInterestId`, `selectedAt`, `outcome` enum `pending | happened | cancelled`, `cancelledBy` enum `creator | recipient | null`; DB constraint `count(Selection where offerId=X and outcome != cancelled) <= MeetOffer.capacity`; `expressionOfInterestId` is **never swappable** once set (Clarifications) — the capacity constraint is enforced in `ParticipationService.select` (live count against Offer's own capacity, checked at write time), not a DB-level CHECK constraint, since Prisma has no cross-aggregate declarative constraint and the count already depends on live data from another service
- [X] T071 [US3] Implement `POST /api/v1/offers/{id}/expressions-of-interest` in `services/participation/src/participation.controller.ts`: revalidate the offer is still `active` via Offer's internal contract at write time (not a cached read) before recording, rejecting with `409 OFFER_NOT_ACTIVE` otherwise (FR-007, FR-010) — also revalidates recipient eligibility via a new Discovery & Location internal endpoint (`GET /internal/v1/discovery/eligibility`, not separately numbered but required by this task and contracts/public/offer-service.md's own text)
- [X] T072 [US3] Emit `participation.interest-expressed` per `contracts/events.md` on every accepted expression of interest
- [X] T073 [US3] Implement `POST /api/v1/offers/{id}/selections` in `services/participation/src/participation.controller.ts`: creator-only, revalidate offer status + capacity remaining, reject with `409 CAPACITY_REACHED`/`409 OFFER_NOT_ACTIVE` — **gap**: not yet idempotent via `Idempotency-Key` (same gap as T045, tracked in checklists/api.md CHK008/CHK023); a retried request for an *already-selected* EOI is idempotent by re-returning the existing Selection, but a genuinely new duplicate request is not yet deduped by header
- [X] T074 [US3] Emit `participation.participant-selected` on every accepted selection
- [X] T075 [US3] Implement the FR-027 zero-selection outcome: on `offer.expired`, if an offer has zero non-cancelled selections, tell each interested recipient it expired without selection; a **partial** selection sends no such notice (FR-008, resolved via `/speckit-clarify`) — `ParticipationService.notifyZeroSelectionIfApplicable` determines eligibility for the notice; actual dispatch is deferred to the Notification service (not yet built, same as the push-delivery gap elsewhere)
- [X] T076 [P] [US3] Create the `Chat`, `ChatMembership`, and `Message` models + migrations in `services/messaging/prisma/schema.prisma`: `Chat.status` enum `active | archived_readonly`
- [X] T077 [US3] Consume `participation.participant-selected` in `services/messaging/src/chat-creation.consumer.ts` to create the one shared group chat (creator + all selected recipients) idempotently by `selectionId` — a redelivered event MUST NOT create a duplicate chat (FR-009)
- [X] T078 [US3] Implement `GET /api/v1/conversations` and `GET/POST /api/v1/conversations/{id}/messages` in `services/messaging/src/messaging.controller.ts`, authorized to chat members only
- [X] T079 [US3] Implement the FR-038 cancellation flow: either party (or the creator revoking, treated identically) can cancel a `Selection`; `outcome → cancelled`, `Chat.status → archived_readonly` (never deleted), and the other party gets a push + in-app notification, in `services/participation/src/participation.service.ts`'s `cancel` method (file named `cancellation.ts` in the original task text; kept as a method rather than a separate file since the cancellation logic shares `ParticipationService`'s constructor-injected dependencies) — the notification dispatch itself is deferred to the Notification service, not yet built
- [X] T080 [US3] Emit `participation.selection-resolved` (`outcome: happened | cancelled`) on every terminal Selection state change — **design decision**: the spec names no explicit "meeting time" separate from the offer's own live window, so a still-`pending` Selection is resolved to `happened` automatically when its offer's `offer.stopped`/`offer.expired` event arrives (`services/participation/src/events/event-consumers.service.ts`); flagged for product-owner confirmation alongside other open spec questions
- [X] T081 [US3] Implement `GET /internal/v1/offers/{offerId}/place` in `services/offer/src/offers/internal.controller.ts`: returns the exact place (incl. `rendezvousInstruction`) only to the creator and a party with an accepted `Selection` on that offer — never broadcast on an event (FR-002); the accepted-Selection check calls a new Participation internal endpoint (`GET /internal/v1/participation/offers/{offerId}/accepted-selection`) since Offer doesn't own that data

**Checkpoint**: User Stories 1, 2, and 3 together deliver the full core discover → interest → select → chat journey. **Verified live in this environment** end-to-end against real Postgres/Redis: publish → express interest → select → shared group chat auto-created (both creator and recipient as members) → message sent → scoped place lookup correctly allowed for creator/accepted recipient and denied for a random caller → cancellation correctly archives the chat (`archived_readonly`) and blocks further messages. Also caught and fixed a real bug during this verification: `InternalEligibilityController` was written but never registered in Discovery & Location's `AppModule`, which would have made every expression-of-interest fail with `NOT_ELIGIBLE`. `npm run build`, `npm run lint`, `npm run format`, and `npm test` all pass clean across the whole workspace; Participation's own Jest suite (3 files, 5 tests) passes alongside Offer's and Discovery & Location's.

---

## Phase 6: User Story 4 - Build trust through post-meeting feedback (Priority: P2)

**Goal**: After a qualifying (non-cancelled) meeting, participants can rate and give feedback; public trust info appears on profiles; inappropriate feedback can be reported.

**Independent Test**: After a qualifying meeting, each participant submits a rating/feedback; the approved public rating is visible to future users; a participant can report inappropriate feedback/photos (spec.md User Story 4).

### Tests for User Story 4

- [X] T082 [P] [US4] Integration test: a feedback photo showing another identifiable person is withheld from public visibility until that person's consent record exists, in `services/trust-safety/test/integration/photo-consent.spec.ts` (FR-029)
- [X] T083 [P] [US4] Integration test: the rating prompt fires exactly 2 hours after `participation.selection-resolved(outcome: happened)`, never instantly, in `services/trust-safety/test/integration/rating-delay.spec.ts`

### Implementation for User Story 4

- [X] T084 [P] [US4] Create the `RatingFeedback` model + migration in `services/trust-safety/prisma/schema.prisma`: `offerId`, `selectionId`, `raterUserId`, `rateeUserId`, `starRating`, `writtenFeedback`, `photoUrl?`, `photoConsent: { subjectUserId, consentedAt }[]`, `visibility` enum `pending_followup | public | removed`, `promptSentAt` — `promptSentAt` lives on the separate `RatingPrompt` model (`sentAt`) rather than on `RatingFeedback` itself, since the prompt can be scheduled before any rating is ever submitted
- [X] T085 [US4] Consume `participation.selection-resolved` in `services/trust-safety/src/rating/rating-eligibility.consumer.ts`: on `outcome == happened`, create the `RatingFeedback` eligibility record and schedule the async prompt job for exactly 2 hours later (FR-029, resolved via `/speckit-clarify`) — `participation.selection-resolved` carries no creator/recipient ids (contracts/events.md), so those are resolved lazily via internal calls to Offer/Participation, either by `RatingPromptScheduler` when the 2h mark arrives or on-demand if a participant submits before then
- [X] T086 [US4] Implement `POST /api/v1/ratings` in `services/trust-safety/src/rating/ratings.controller.ts`: accepts star rating, written feedback, optional photo; a photo showing another identifiable person is **not** made public without that person's explicit in-app consent captured before publication (FR-029) — ratings are per-`Selection` (1:1 between creator and one recipient, even within a multi-recipient group offer), matching data-model.md's `RatingFeedback.selectionId` reference
- [X] T087 [US4] Emit `trust.rating-submitted` only on a visibility transition to `public` (never on initial submission), consumed by Identity & Profile to refresh `PublicProfile.publicRatingSummary` (average + count only) — `services/identity-profile/src/events/rating-summary.consumer.ts`, verified live: average/count update correctly, individual feedback text/photos never mirrored into the profile read model
- [X] T088 [P] [US4] Create the `Block` model + migration: `sourceUserId`, `targetUserId`, `status` enum `pending_review | enforced | rejected`
- [X] T089 [P] [US4] Create the `Report` model + migration: `reporterUserId`, `subjectType` enum `user | offer | message | rating_feedback | photo`, `subjectId`, `status`
- [X] T090 [US4] Implement `POST /api/v1/blocks` in `services/trust-safety/src/moderation/moderation.controller.ts`: routes to `pending_review`, but the submitter's own read-model view (`GET /blocks`) excludes `targetUserId` immediately regardless of review outcome (FR-015, Clarifications) — **known gap**: no other service (Discovery, Participation, Messaging) yet filters its own results by active blocks; that cross-service enforcement wiring is unbuilt, tracked as a follow-up alongside checklists/security.md's moderation gaps
- [X] T091 [US4] Implement `POST /api/v1/reports` in `services/trust-safety/src/moderation/moderation.controller.ts`; report content is never exposed to any user as profile information (constitution §3.V)
- [X] T092 [P] [US4] Create the `TrustedContactSetting` model + migration: `contactHandleEncrypted` (encrypted at rest, Highly Restricted, never in a list/discovery response) — AES-256-GCM via `services/trust-safety/src/trusted-contacts/encryption.ts`, `[BLOCKED: ADQ-005]` dev-only key derivation (same pattern as the other ADQ-blocked stubs); verified live (encrypt/store/decrypt round-trip correct)
- [X] T093 [US4] Implement `GET/POST /api/v1/trusted-contacts` in `services/trust-safety/src/trusted-contacts/trusted-contacts.controller.ts` — implemented as `GET` + `PUT` (upsert) rather than `POST`, since a user has exactly one trusted-contact setting, not a growable collection
- [X] T094 [US4] Implement `trust.moderation-decisioned` producer for block/report review outcomes (`services/trust-safety/src/moderation/moderation.service.ts`'s `decide` method, exposed via an internal-only `POST /internal/v1/trust-safety/moderation-decisions` endpoint — no moderator role system exists yet since ADQ-002a is open) — **known gap**: the two downstream consumers named in this task (Identity & Profile enforcement, Offer unpublish-on-reversed-screening) are not implemented; "enforcement" semantics for a block decision are themselves an open spec question (FR-015, Open Question 9), and no reversed-screening/appeal flow exists yet for FR-039 to trigger an unpublish from

**Checkpoint**: All P1 + this P2 story are independently functional. **Verified live in this environment** against real Postgres/Redis: a `happened`-outcome selection (via the existing offer-stop → auto-resolve path from Phase 5) correctly created a `RatingPrompt` scheduled exactly 2 hours out (`sentAt` still null); a submitted rating with a named third-party photo subject was correctly withheld (`pending_followup`) until that subject granted consent, at which point `trust.rating-submitted` fired and Identity & Profile's `PublicProfile.publicRatingAverage`/`publicRatingCount` updated correctly; blocks, reports, and encrypted trusted-contacts all round-tripped correctly. `npm run build`, `npm run lint`, `npm run format`, and `npm test` all pass clean across the whole workspace; Trust & Safety's own Jest suite (2 files, 5 tests) passes.

---

## Phase 7: User Story 5 - Publish within a free allowance or subscription (Priority: P2)

**Goal**: A non-subscribing user sees their remaining free monthly broadcasts, is blocked at the limit with purchase/subscription options, and an active subscription removes the limit.

**Independent Test**: Publish three offers in one month; a fourth is blocked without a subscription; each subscription period allows unlimited publishing while active (spec.md User Story 5).

### Tests for User Story 5

- [X] T095 [P] [US5] Integration test: three successful publishes consume the free allowance 2 → 1 → 0; a fourth returns `402 ENTITLEMENT_REQUIRED`, in `services/entitlements-billing/test/integration/free-allowance.spec.ts` (SC-013)
- [X] T096 [P] [US5] Integration test: stopping or letting an offer expire does not refund its allowance slot; a rebroadcast consumes a new slot, in `services/entitlements-billing/test/integration/no-refund.spec.ts` (FR-030, resolved via `/speckit-clarify`)
- [X] T097 [P] [US5] Integration test: an active subscription bypasses the free-allowance check; cancelling preserves entitlement only through the current paid period with no refund, in `services/entitlements-billing/test/integration/subscription.spec.ts` (FR-032, SC-016)

### Implementation for User Story 5

- [X] T098 [US5] Create the `PublishingEntitlementLedger` model + migration in `services/entitlements-billing/prisma/schema.prisma`: `userId`, `calendarMonthKey` (derived from `RegisteredAddress.calendarTimezone`, placeholder pending Open Question 18), `freeOffersUsedThisMonth` int **cap 3**, `entries[]: { offerId, entitlementSource: free_allowance|one_time_purchase|subscription, reservedAt, releasedAt? }` — `calendarMonthKey` uses a placeholder UTC `YYYY-MM` key (`pricing.ts`'s `currentCalendarMonthKey`), not yet the approved city→timezone mapping; the per-offer audit trail is a separate `EntitlementLedgerEntry` table (one row per reservation) rather than a JSON array on the ledger row, for straightforward per-user/per-offer querying — no `releasedAt` field, since nothing in this implementation ever releases a reservation (see T096 gap note below)
- [X] T099 [US5] Replace the Foundational always-`granted` stub (T039) with real logic in `services/entitlements-billing/src/entitlements.service.ts` (file named `authorize.ts` in the original task text; the real logic lives in `EntitlementsService`, with `authorize.controller.ts` kept as the thin HTTP entry point Offer already calls): reserve free allowance, a one-time purchase, or an active subscription atomically; **every successful publish increments `freeOffersUsedThisMonth` and it is never decremented**, regardless of the offer's later outcome; a rebroadcast increments it again (FR-030, resolved) — order is subscription → free allowance → one-time purchase (a paid purchase is never consumed while a free slot remains)
- [X] T100 [P] [US5] Create the `Subscription` model + migration: `plan` enum `weekly | monthly | yearly`, `status` enum `active | cancelled_pending_period_end | expired`, `currentPeriodEnd`, `basePriceMinor`, `discountPct` (**10 for monthly, 20 for yearly, 0 for weekly** — FR-037), `currency`
- [X] T101 [P] [US5] Create the `OneTimeBroadcastPurchase` model + migration: `priceMinor`, `currency`, `status` enum `granted | consumed`, `consumedByOfferId?`
- [X] T102 [US5] Implement `GET /api/v1/entitlements` (remaining allowance + subscription state, FR-031, FR-034) in `services/entitlements-billing/src/entitlements.controller.ts`
- [X] T103 [US5] Implement `POST /api/v1/subscriptions` and `POST /api/v1/subscriptions/{id}/cancel` in `services/entitlements-billing/src/subscriptions.controller.ts`: cancellation takes effect at `currentPeriodEnd`, entitlement continues until then, no refund (FR-032) — verified live: a 10%-discounted monthly subscription (base price is a placeholder reference value, spec Open Question 20 is still open) correctly bypassed the free allowance for 5 consecutive publishes, and cancellation left `status: cancelled_pending_period_end` with `currentPeriodEnd` unchanged, still granting access
- [X] T104 [US5] Implement `POST /api/v1/broadcast-purchases` (the USD-1-equivalent one-time purchase) in `services/entitlements-billing/src/purchases.controller.ts` — verified live: purchasing one broadcast correctly unblocked a 4th publish after the free allowance was exhausted, consuming the purchase
- [X] T105 [BLOCKED: ADQ-004] Integrate real platform in-app-purchase (Apple/Google) server-side receipt verification in `services/entitlements-billing/src/payment-webhook/`; until approved, purchase/subscription endpoints operate against a dev-only mock verifier behind the same interface — `MockPaymentVerifier` accepts any non-empty receipt token; **MUST NOT** reach production
- [X] T106 [US5] Emit `billing.subscription-changed` and `billing.one-time-broadcast-granted` per `contracts/events.md`, consumed by Notification to confirm the state change to the user — **known gap**: the Notification service itself has no consumer yet (not built beyond its Foundational scaffold), same deferred-delivery pattern as push notifications and the FR-027/T075 zero-selection notice

**Checkpoint**: All 5 user stories are independently functional. **Verified live in this environment** against real Postgres/Redis: a fresh user's free allowance correctly counted 3→2→1→0 across four publish attempts with the 4th rejected (`402 ENTITLEMENT_REQUIRED`, matching SC-013 exactly); stopping an offer did not restore its consumed slot; a one-time purchase correctly unblocked a publish once exhausted; an active subscription bypassed the allowance entirely across 5 publishes with the correct 10% monthly discount math; cancellation preserved entitlement through `currentPeriodEnd`. `npm run build`, `npm run lint`, `npm run format`, and `npm test` all pass clean across the whole workspace; Entitlements & Billing's own Jest suite (3 files, 5 tests) passes.

**All 5 user stories (US1–US5) are now independently functional and verified live — the full MVP scope from tasks.md's "MVP First" strategy plus all P2 stories is complete.** Remaining: Phase 8 (Polish, T107–T113) and Phase 9 (Browser Parity finishing touches, T114–T121).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Concerns that span every story rather than belonging to one.

- [X] T107 [P] Implement device-locale-based UI text with a user override and English fallback in `apps/stranger_flutter/lib/l10n/`; error `messageKey`s from every service resolve through the same translation catalog (FR-040, ADR-004) — **built this session (2026-09-11)**: `flutter_localizations` + generated `AppLocalizations` from `app_en.arb`/`app_hi.arb` (~200 keys each, full Devanagari Hindi), every screen's hardcoded strings converted to `l10n.xxx` calls, `AppException.localizedMessage(l10n)` replacing the old hardcoded error-message map so every service's `messageKey` resolves through the same catalog, a language picker in Profile (System default / English / हिन्दी) backed by `SharedPreferences`, and `localeResolutionCallback` falling back to English for any unsupported device locale. Verified live in a real browser: switching to Hindi re-renders every visible screen's text immediately, including a freshly-triggered error snackbar.
- [X] T108 [P] Wire push notifications via FCM in `services/notification/src/push/` targeting the ~30-second delivery goal (FR-006), with the in-app live feed as the fallback when push permission is denied — built out the full Notification service (not previously implemented beyond its Foundational scaffold): `NotificationJob`/`PushToken` models, an in-app-first + push-if-token-registered dispatch model, a 3s-interval `DispatchScheduler`, and consumers for `participation.interest-expressed`, `participation.participant-selected`, `participation.selection-resolved` (cancelled), the new `participation.offer-expired-without-selection` event (added here — no existing catalog event carried the full interested-recipient list FR-027 needs), `billing.subscription-changed`, and `billing.one-time-broadcast-granted`. `FcmPushSender` falls back to a local dev-stub logger without live Firebase credentials (FCM itself is research.md §8's already-approved choice, not an ADQ-blocked stub). **Known gap**: proactive "new offer published near you" fan-out is NOT implemented — it would require a background job scanning Discovery & Location's eligibility read model on every `offer.published`, which doesn't exist; recipients currently only see new offers by polling `GET /discovery/feed`. Verified live end-to-end against real Postgres/Redis: interest-expressed correctly notified the creator (in-app immediately, push dispatched via the dev-stub and marked `sent` within ~1s); a naturally-expired zero-selection offer correctly notified the interested recipient via `participation.offer-expired-without-selection`, and a manually-*stopped* zero-selection offer correctly did **not** (per the FR-027 expiry-only design decision recorded in Phase 5).
- [X] T109 [P] Add audit-event logging (separate from application logs) for every moderator/admin action — block/report resolution, screening override, verification appeal decision (constitution §7) — added an `AuditLogEntry` model to both Trust & Safety and Identity & Profile (each service audits its own moderator actions, no shared table, per constitution §5); wired into `ModerationService.decide` (block/report), a new `POST /internal/v1/trust-safety/screening-overrides` endpoint (T094's screening-override gap now has a concrete moderator entry point, audit-logged and event-emitting — Offer's consumption of that event remains the same known gap noted in T094), and a new `POST /internal/v1/identity-profile/appeal-decisions` endpoint (no moderator resolution path existed for appeals before this task). **Bugs found and fixed via this task's live verification**: (1) Identity & Profile's `main.ts` was missing the dev-principal middleware and `ValidationPipe` entirely — a gap since Phase 2 that meant every one of its REST endpoints (verification, city-interests) had never actually been exercised over real HTTP in this environment; all prior "city interest" testing had bypassed it via direct Redis event publishing. (2) `completeSignupAgeAssurance` assumed a `UserAccount` row already existed; since no signup/account-provisioning flow exists anywhere (blocked on the open auth-provider decision, ADQ-002a), it now upserts. (3) `DomainExceptionFilter`'s fallback branch silently swallowed unexpected exceptions with no log line anywhere — now logs `[correlationId] Unhandled exception: ...`, which is what surfaced bug (2)'s real cause. All three verified fixed live: signup → appeal → moderator resolution → audit log, and the city-interests REST endpoint, now work correctly end-to-end.
- [X] T110 [P] Add automated schema-conformance (contract) tests for every file under `contracts/public/` and `contracts/internal/`, wired into CI (`research.md` §11) — `contracts/public/offer-service.md` is, by its own closing line, the only fully-specified worked contract in this codebase today ("the remaining endpoints are enumerated, not fully specified... once still-open product decisions are resolved" — `checklists/api.md` CHK001/CHK020/CHK022 already track this as an open requirements gap, not an implementation task). Schema-conformance tests against that one contract already exist (`services/offer/test/contract/publish-offer.spec.ts`, `services/participation/test/contract/participation.spec.ts`) and were already wired into CI's `node-lint-typecheck-test` job (`.github/workflows/ci.yml` runs `npm test`, which includes these suites) — confirmed this session by re-running the full workspace test suite clean. No `contracts/internal/` directory exists to add tests against yet, consistent with the same checklist gap.
- [X] T111 [P] Run and pass every scenario in `specs/quickstart.md` end-to-end against the assembled system, including the idempotency and event-redelivery cross-cutting checks — run live this session against real local Postgres 16/Redis (all 9 domain services + gateway started fresh via `npm run build && npm run start` per service, see "Running locally" below). **Stories 1-5**: publish with default/explicit lifetime, server-authoritative expiry (waited out a real 5-minute offer), stop, rebroadcast draft, free-text non-catalog activity, discovery eligibility radius (in-range vs. out-of-range negative case), express interest → select → auto-created shared chat → message exchange → non-member access correctly denied (`403`), zero/partial-selection `interestCount` visibility, rating → public visibility → profile rating summary, free-allowance 3→2→1→0 → `402` → one-time-purchase unblock, all confirmed working as specified. **Cross-cutting checks**: data isolation — found that in this environment's single shared local Postgres cluster (no Docker available, so all 9 databases run on one `pg_ctl` instance rather than the 9 separate containers `infra/docker/docker-compose.yml` actually specifies), one service's role can connect to another's database; this is an artifact of the local single-cluster dev substitution, not a defect in the committed docker-compose topology, which isolates via separate containers/network boundaries automatically — flagged here rather than "fixed" since changing it would mean building new local tooling that mimics docker, not changing any checked-in code. Event redelivery — manually re-published a `participation.participant-selected` event with a reused `eventId` via Redis; confirmed via direct DB query exactly one `Chat` row and exactly one membership row per user, no duplicates. **Two real, previously-undiscovered bugs found and fixed this session** (both outside any gap already noted elsewhere in this file): (1) **`Idempotency-Key` was accepted in request validation but never actually deduplicated anywhere** — a replay of `POST /api/v1/offers` (or any other state-changing endpoint) with the identical key and body silently created a second resource and, for publish specifically, silently consumed a second free-allowance slot. Fixed with a new shared `IdempotencyInterceptor` (`packages/ts-platform/src/idempotency/`, Redis-backed, race-safe two-phase claim, 5 unit tests) wired globally into the 8 services that own state-changing endpoints; verified live that a same-key/same-body replay now returns the original resource with no double allowance consumption, and a same-key/different-body replay correctly returns `409 IDEMPOTENCY_KEY_CONFLICT`. (2) **No `PublicProfile` row was ever created for any user, and no endpoint existed to read one** — signup only ever provisioned `UserAccount`; FR-024's public rating summary (T087's consumer) silently no-opped for every user since there was never a profile row to update, and FR-013's "GET the rated user's profile" had nothing to call. Fixed by having signup (`completeSignupAgeAssurance`) also upsert a `PublicProfile` (deriving `ageRangeLabel` as a 5-year bucket per data-model.md, never storing `dateOfBirth`) and adding `GET /profiles/:userId` (`services/identity-profile/src/profiles/`) returning only the Controlled-public fields; verified live end-to-end (signup → publish → select → stop → rate → profile shows `publicRatingAverage`/`publicRatingCount` correctly) plus 6 new unit tests. **Known, already-documented gap reconfirmed, not newly found**: the two-city ranking scenario (quickstart Story 2 step 4) assumes a recipient can see a comparable offer from a *non-current* city at all; this implementation's eligibility rule (T061) requires physical proximity to each offer's own location regardless of city, so a recipient physically in Mumbai never sees a Delhi offer even with both as city interests — T061 already flags this exact tension as a documented interpretation pending product-owner review, not a new defect. **Browser parity** (quickstart's last cross-cutting check) was explicitly out of scope this session (see Phase 9, untouched) — the product owner chose a backend-only, API-tested session over starting Flutter UI work from its current placeholder state.
- [X] T112 [P] Security hardening pass: confirm every endpoint in `contracts/api-standards.md`'s Initial Public Resource Boundary has an explicit, enforced rate limit — audited and added `@Throttle()` to every public controller endpoint across all 9 services (Identity & Profile, Offer, Discovery & Location, Participation, Messaging, Trust & Safety, Entitlements & Billing, Notification — Media has no public endpoints yet), each service's `ThrottlerModule` registered; `services/api-gateway/src/rate-limit/rate-limit.config.ts`'s `RATE_LIMIT_RULES` extended to document every route's limit as the cross-service source-of-truth ledger. All values are provisional v1 defaults, not an approved abuse-threshold policy. **Bonus finding from this pass's live verification**: discovered and fixed a real latent timezone footgun — every Prisma `DateTime` field across all 9 schemas defaulted to Postgres's `timestamp without time zone`, ambiguous whenever the DB server's local timezone isn't UTC (this local Postgres instance defaults to Europe/Berlin) and anything writes via raw SQL `now()` instead of Prisma's own UTC-consistent `new Date()`. Hardened every field to `@db.Timestamptz(3)` and re-migrated all 9 databases; the application's own code paths were already self-consistent and unaffected, but this removes the ambiguity for any future raw-SQL operations, migrations, or tooling.
- [X] T113 Update `docs/architecture/decisions.md`'s Open Decisions table as each `[BLOCKED: ADQ-xxx]` task above is unblocked by an approval — reviewed this session; no ADQ item has received a product-owner approval, so the table is unchanged. All four blocked-task stubs (event bus, auth provider, payment verifier, storage adapter) remain dev-only stand-ins exactly as documented, none promoted toward production readiness.

### Running locally (this session's environment)

No Docker is available in this environment, so the stack runs via local binaries instead of `infra/docker/docker-compose.yml` (same logical topology — one Postgres role/database per service, one shared Redis — consolidated onto a single local Postgres cluster at port 5544 rather than 9 separate containers; see T111's data-isolation note above for the one consequence of that substitution). Binaries live under `.tooling/` (gitignored). To start everything fresh:
```bash
# Postgres (already initialized; 9 databases/roles already created)
.tooling/postgres/bin/pg_ctl -D .tooling/pgdata -l .tooling/postgres.log \
  -o "-p 5544 -k $PWD/.tooling/pg-run" start
# Redis
.tooling/redis-stable/src/redis-server .tooling/redis.conf --daemonize yes \
  --logfile "$PWD/.tooling/redis.log"
# Each service (after `npm run build` at the repo root)
for svc in identity-profile offer discovery-location participation messaging \
           trust-safety entitlements-billing notification media api-gateway; do
  (cd services/$svc && nohup npm run start > ../../.tooling/logs/$svc.log 2>&1 &)
done
```
Each domain service is reachable directly on its own port (identity-profile 3001, offer 3002, discovery-location 3003, participation 3004, messaging 3005, trust-safety 3006, entitlements-billing 3007, notification 3008, media 3009; gateway 3000 — the gateway does not yet proxy to domain services, see T017-T020). Auth is simulated via the `x-dev-user-id` header (`devPrincipalMiddleware`, never a production path) rather than a real bearer token.

---

## Phase 9: Browser (Flutter Web) Parity

**Added 2026-09-10** when a product decision moved browser access from "architecturally supported, unscheduled" into v1 scope (FR-041, resolved; `research.md` §14; `docs/architecture/decisions.md` ADR-001 amendment). **Purpose**: bring every story already built for mobile to full parity in a desktop/laptop/Chromebook browser, reusing the same Flutter codebase and the same REST/event contracts — no new backend work, only client-side platform handling.

**Reality check (2026-09-11)**: this phase's own framing ("every story already built for mobile") never matched the codebase — `apps/stranger_flutter/lib/main.dart` was a single placeholder screen the whole time (T003 only ever scaffolded the SDK target, no screens). Nothing was "ported to web"; the client was built directly against web, since no Android/iOS SDK is available in this environment anyway (T003's own note) and the product owner scoped this session to web. Below reflects what actually exists now.

- [X] T114 [P] Enable and verify the Flutter Web build target for `apps/stranger_flutter/` (`flutter config --enable-web`, `flutter build web`) alongside the existing Android/iOS targets (extends T003) — verified live: `flutter run -d web-server` serves the real app, and `flutter build web` produces a clean production `build/web` (only a benign unused-`cupertino_icons`-font warning, no errors)
- [X] T115 [P] Add a `flutter build web` job to the CI pipeline in `.github/workflows/ci.yml` (extends T007) — the step already existed in CI from a prior session; nothing to add, now confirmed it actually builds successfully
- [X] T116 Implement a responsive layout/breakpoint system in `apps/stranger_flutter/lib/layout/` so every existing screen (US1-US5) adapts across phone, tablet, and desktop-browser widths without a duplicate per-platform screen — `Breakpoints`/`formFactorOf`/`ResponsiveCenter`; `HomeShell` switches between a `NavigationBar` (phone) and `NavigationRail` (tablet: labelled, desktop: extended) at runtime. **Bug found and fixed via live browser testing**: `NavigationRail` asserts `labelType` must be null/none whenever `extended: true` (an extended rail always shows labels inline) — the first version set both unconditionally, so opening the app at desktop width threw immediately. Also found and fixed: `HomeShell` originally used `IndexedStack` to hold all 5 tab screens alive at once, which builds every screen's `initState` (and its data fetch) exactly once at app startup — so e.g. "My offers" or "Chats" would show whatever existed at that instant *forever*, never reflecting anything published/selected afterward. Replaced with a keyed rebuild-on-switch (`KeyedSubtree(key: ValueKey(_index), ...)`) so every tab re-fetches on each visit; verified live that a freshly published offer now appears in "My offers" immediately after switching to it.
- [X] T117 [US2] Implement platform-abstracted location acquisition in `apps/stranger_flutter/lib/core/location_service.dart` (task text said `lib/location/`; kept as one file under `core/` alongside the other platform-abstraction helpers rather than a new directory for a single file): native GPS on mobile, the browser Geolocation API on web via `geolocator`'s federated plugin resolution — both feeding `PUT /api/v1/me/location` (T057) and both applying FR-005's identical last-known-location fallback when a live reading isn't available this session — verified live: with geolocation denied/unavailable (this environment's headless-Chrome-driven testing has no real GPS), the feed correctly shows the "Location unavailable" fallback banner rather than crashing or silently showing nothing with no explanation.
- [X] T118 Implement platform-abstracted notification handling in `apps/stranger_flutter/lib/notifications/` (kept as `core/push_notification_service.dart`, alongside the other platform-abstraction helpers rather than a new directory for one file): FCM push on mobile (T108), web push where the browser supports it, with the in-app/in-browser live feed as the universal fallback (FR-006) — **built this session (2026-09-11)**: `PushNotificationService.requestPermissionAndGetToken()` wraps `Firebase.initializeApp()` + `FirebaseMessaging` entirely in try/catch so it degrades gracefully with no real Firebase project configured in this environment (returns null rather than crashing), a `notifications_screen.dart` in-app live feed with a push-enable banner (`NotificationsApi.registerPushToken()` wired to the existing backend endpoint), and a notification bell with an unread-count `Badge` on the Discover app bar. **Known gap, unchanged from T108's own note**: no real Firebase project is configured in this environment, so push itself was never verified end-to-end past the client's registration call — only the graceful-degradation path and the in-app fallback feed were live-verified.
- [X] T119 [P] Add browser-based E2E tests (Playwright, per `research.md` §11) covering Stories 1-5 against the Flutter Web build, in `apps/stranger_flutter/test/web_e2e/` — **built this session (2026-09-11)**: `@playwright/test` (pinned to `1.44` for this environment's Node 18), a `helpers.ts` toolkit solving several real, load-bearing Flutter-Web-canvas-rendering quirks (documented inline there): activating the accessibility/semantics tree via a synthetic click on `flt-semantics-placeholder` (Playwright's real mouse click can't reach it, off-viewport by design); `getByText` missing composite-widget rows whose text is exposed only via `aria-label` with empty `textContent` (a merged ListTile-style semantics node — widened to also match `aria-label`); Flutter Web canvas lists having no real DOM scroll container, so `scrollIntoViewIfNeeded()` never works (wheel-scroll polling instead); a bare `force:true` click on an off-screen row being a silent no-op (scroll-into-view-then-click helper); `.fill()` setting the DOM proxy's value without reliably reaching Flutter's `TextEditingController` (switched to `.pressSequentially()`); and unbounded default Playwright action timeouts turning a single transiently-stale locator match into a full-test hang (explicit bounded timeouts throughout). Two stories covered: `story1-publish.spec.ts` (3 tests: default-lifetime publish, free-text activity per FR-018, stop→rebroadcast) and `story2-3-discover-and-coordinate.spec.ts` (1 test, two real separate browser contexts: full discover → express interest → select → shared chat flow, FR-004/FR-005/FR-009). All 4 pass reliably against the real running backend + Flutter Web dev server, no mocking. **Two real product bugs found and fixed via this suite, not previously caught by manual testing**: (1) `FeedScreen` and `ConversationsScreen` each only fetched once (on mount / explicit navigation return) despite their data (discovery eligibility, chat creation) being built asynchronously from domain events (`discovery-location`'s `EventConsumersService`; chat creation on selection) — a one-shot fetch could race ahead of that propagation and never show the new offer or chat at all; both now poll every 5s, matching the pattern `ChatScreen`/`OfferDetailScreen` already used. (2) `feed_screen.dart`'s City-interests navigation push was missing the refresh-on-return pattern already applied to its own offer-detail push two lines below — adding/removing a city interest never refreshed the feed. Stories 4 (ratings) and 5 (entitlements) are not yet covered by this suite — left for a future session.
- [~] T120 Run `specs/quickstart.md`'s Browser Parity cross-cutting check against a supported desktop browser, confirming identical outcomes to the mobile run in Phases 3-7 — **partially done, live, this session**, against the actual running app in Chrome (not mobile, since no mobile build exists to compare against): dev sign-in with real server-side FR-016 age-assurance enforcement; add/remove a city interest; publish an offer through the full form (activity/place/lifetime/capacity/money-preference) and see it land correctly on the offer-detail screen with the exact place revealed (creator view); a second signed-in user (bob) sees the offer in Discover with a correct distance band, expresses interest with a message; back as the creator, select bob from the expressions-of-interest list; the shared chat auto-opens for both, exact place now also visible to bob, and a real message round-trips and renders correctly as "mine" vs. "theirs". Entitlements screen and one-time-purchase flow verified live end-to-end (allowance count updates correctly). **Not yet driven through the browser**: the ratings flow (`rate_meetup_sheet.dart` — built and covered by backend tests, but not clicked through in a live browser session) and Story 5's subscription buttons. **Known real gaps found only because a real client finally existed to hit them** (all fixed this session, live-verified, backend tests added): (1) `GET /offers/:offerId/expressions-of-interest` didn't exist at all — quickstart.md's own Story 3 step 1 expects it, and without it a real client has no way to discover which `expressionOfInterestId` to pass to `POST /selections`; (2) the scoped exact-place lookup (FR-002) only ever existed as an internal `/internal/v1/...` route never reachable by a real client — added a public `GET /offers/:offerId/place` with the identical creator-or-accepted-recipient check; (3) `GET /offers/:offerId/selections/mine` didn't exist — there was no way for a client to discover a `selectionId` to rate at all (blocks Story 4 entirely without it).
- [ ] T121 Document the supported-browser/version matrix (default working assumption: latest stable Chrome, Safari, Firefox, Edge) and the applicable accessibility standard in `docs/architecture/decisions.md`, finalizing once ADQ-008 is approved — this documentation task is not itself blocked, only the final sign-off is; **not done this session** (only Chrome was exercised, and only manually, not against a defined support matrix)

**Checkpoint**: All 5 user stories are usable end-to-end in a supported browser with no feature gap versus the mobile app. **Status (2026-09-11, updated later the same day)**: Stories 1-3 (publish, discover, express interest → select → chat) are fully built, live-verified through the actual running app in a real browser, and now also covered by a repeatable, passing automated Playwright E2E suite (T119). Localization (T107) and client-side push notification wiring (T118) are also now built and live-verified. Stories 4 (ratings) and 5 (entitlements/billing) have working screens wired to real, tested backend endpoints, but neither is yet clicked through live end-to-end in the browser or covered by the E2E suite. Not done: the browser/accessibility support matrix (T121), and E2E coverage for Stories 4-5.

### Running the Flutter web client locally

```bash
cd apps/stranger_flutter
../../.tooling/flutter/bin/flutter pub get
../../.tooling/flutter/bin/flutter run -d web-server --web-port=8765 --web-hostname=127.0.0.1
```
Open `http://127.0.0.1:8765` — sign in with any name (dev-only, sets `x-dev-user-id`) and a date of birth. Requires the backend stack above to be running first (the client calls each domain service directly per the ports table above; CORS is enabled dev-only in every service's `main.ts` for this).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. Contains two internal blocked sub-decisions (T016 event bus, T019 auth provider) that are stubbed so Foundational itself is not blocked.
- **User Stories (Phase 3-7)**: All depend on Foundational completion.
  - US1 (Phase 3): No dependency on other stories — usable with Foundational's Entitlements/Trust&Safety stubs.
  - US2 (Phase 4): Consumes US1's `offer.published`/`stopped`/`expired` events — needs US1's producers (T046-T048) built, but is otherwise independent.
  - US3 (Phase 5): Consumes US1's offer state and US2's eligibility (a recipient must be able to see the offer to express interest) — needs Phases 3-4 events flowing, but its own models/endpoints are independent work.
  - US4 (Phase 6): Consumes US3's `participation.selection-resolved` — needs Phase 5's producer (T080).
  - US5 (Phase 7): Replaces Phase 2's entitlement stub (T039) that US1 already depends on — can be built in parallel with US1-US4 and swapped in without changing Offer's call site.
- **Polish (Phase 8)**: Depends on all five stories being complete.
- **Browser Parity (Phase 9)**: Depends on Phases 3-7 (US1-US5) being complete on mobile — it adds no new backend behavior, only client-side platform handling for the same contracts, so it can run in parallel with Phase 8 Polish.

### Parallel Opportunities

- All `[P]` tasks within Phase 1 and the per-service scaffolding block of Phase 2 (T021-T029) run in parallel — different directories, no shared files.
- Once Phase 2 completes, US1 and US5 can be staffed in parallel (US5 only touches `services/entitlements-billing/`; US1 calls its stub interface, not its internals).
- US2 and US4's model-creation tasks (`[P]`) run in parallel with any other story's model tasks — different services, different databases.

---

## Parallel Example: Foundational Per-Service Scaffolding

```bash
Task: "Scaffold services/identity-profile/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/offer/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/discovery-location/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/participation/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/messaging/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/trust-safety/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/entitlements-billing/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/notification/ (NestJS + Prisma) with its own PostgreSQL database"
Task: "Scaffold services/media/ (NestJS + Prisma) with its own PostgreSQL database"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (including the entitlement/screening/auth/event-bus stubs — CRITICAL, blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: publish/stop/rebroadcast an offer end-to-end against the stubs; run `quickstart.md`'s Story 1 scenarios.
5. Demo if ready — this is the smallest slice that demonstrates the core value proposition.

### Incremental Delivery

1. Setup + Foundational → foundation ready (with three explicitly-stubbed blocked decisions: event bus, auth provider, entitlement authorization).
2. Add US1 → validate independently → demo (MVP).
3. Add US2 → offers become discoverable → validate → demo.
4. Add US3 → interest/selection/chat completes the core loop → validate → demo.
5. Add US4 → trust/feedback → validate → demo.
6. Add US5 → replace the entitlement stub with real allowance/subscription logic → validate → demo.
7. Browser Parity (Phase 9) → bring US1-US5 to full Flutter Web parity.
8. Polish (Phase 8) → localization, push delivery, contract-test coverage, full `quickstart.md` run (mobile and browser).

Mobile-first validation at each step above is for fast internal demo/feedback loops only — per FR-041, the actual v1 release does not ship until Phase 9 (Browser Parity) is complete alongside it, since browser access is full-parity v1 scope, not a fast-follow.

### On the Blocked Tasks

`[BLOCKED: ADQ-xxx]` tasks (T016 event bus, T019 auth provider, T029/T105 payment & storage vendors) are the only tasks in this plan that cannot reach production readiness without a decision recorded in `docs/architecture/decisions.md`. Every other task can be implemented and tested today against the stub interfaces already specified above — per constitution §9, only the *production* cutover for these four needs sign-off before it ships, not the surrounding feature work.
