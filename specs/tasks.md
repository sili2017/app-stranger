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

- [ ] T001 Create the monorepo directory skeleton exactly as listed in `specs/plan.md`'s Project Structure (`apps/`, `services/`, `python-services/ai-safety/` placeholder, `contracts/{public,internal,events}/`, `packages/`, `infra/{docker,environments,migrations,observability}/`, `docs/{product,requirements,architecture}/`)
- [ ] T002 [P] Initialize a pnpm/npm workspace at the repo root (`package.json`, `pnpm-workspace.yaml`) covering every directory under `services/` and `packages/`
- [ ] T003 [P] Initialize the Flutter project in `apps/stranger_flutter/` targeting Android and iOS phones/tablets AND the Flutter Web build target for desktop/laptop/Chromebook browsers, per `plan.md` Target Platform (FR-041, resolved 2026-09-10 — browser access ships in v1 with full parity; web build enablement detailed in Phase 9 below)
- [ ] T004 [P] Configure ESLint + Prettier for all TypeScript packages/services at the repo root (`.eslintrc`, `.prettierrc`)
- [ ] T005 [P] Configure `flutter analyze` + `dart format` CI check for `apps/stranger_flutter/`
- [ ] T006 [P] Author `infra/docker/docker-compose.yml` with one PostgreSQL instance per service (9 databases), one shared Redis, and a local event-bus emulator placeholder, per `research.md` §4-5
- [ ] T007 [P] Author the GitHub Actions CI skeleton in `.github/workflows/ci.yml`: lint, type-check, and unit test per changed service/package (constitution §4 CI/CD, §8 quality gates)
- [ ] T008 [P] Scaffold `packages/ts-platform/` (empty module structure: `errors/`, `events/`, `outbox/`, `observability/`) per `plan.md` Project Structure
- [ ] T009 [P] Scaffold `packages/dart-design-system/` (empty theme/component module) for shared Flutter UI
- [ ] T010 [P] Scaffold `packages/test-fixtures/` for shared contract/test fixtures referenced by later contract-test tasks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure and the minimum Identity & Profile + stub Entitlements/Trust&Safety surface every user story's Independent Test needs (a registered, age-eligible user must exist before any offer can be published, discovered, joined, rated, or billed).

**⚠️ CRITICAL**: No user story phase may begin until this phase is complete.

### Shared platform libraries

- [ ] T011 [P] Implement the standard error envelope (`code`, `messageKey`, `correlationId`, `details`) from `contracts/api-standards.md` as Nest exception filters in `packages/ts-platform/src/errors/`
- [ ] T012 [P] Implement the domain-event envelope (`eventId`, `eventType`, `aggregateId`, `aggregateVersion`, `occurredAt`, `correlationId`, `causationId`, `producedBy`, `schemaVersion`) from `contracts/events.md` as a typed publish/subscribe client in `packages/ts-platform/src/events/`
- [ ] T013 Implement the transactional-outbox table schema + relay worker pattern (constitution §5) in `packages/ts-platform/src/outbox/`, reusable by every service's Prisma schema
- [ ] T014 [P] Implement idempotent-consumer dedupe-by-`eventId` helper in `packages/ts-platform/src/events/idempotency.ts`
- [ ] T015 [P] Configure Sentry + structured logging with PII-safe redaction (never log chat content, verification documents, payment identifiers, or precise coordinates — constitution §5, §7) in `packages/ts-platform/src/observability/`
- [ ] T016 [BLOCKED: ADQ-001] Provision the durable event bus (vendor per `research.md` §5) and wire `packages/ts-platform/src/events/` to it; until approved, all services run against a local in-memory/Redis-backed pub/sub substitute behind the same interface so Foundational and story work is not blocked

### API Gateway

- [ ] T017 Scaffold the API Gateway as a NestJS app in `services/api-gateway/` exposing `/api/v1` per `contracts/api-standards.md` versioning rule
- [ ] T018 Implement request-correlation-id and `Accept-Language`-aware routing middleware in `services/api-gateway/src/middleware/`
- [ ] T019 [BLOCKED: ADQ-002a] Implement OAuth2/OIDC bearer-token validation at the gateway in `services/api-gateway/src/auth/`; until an auth provider is approved, the gateway validates against a local dev-only OIDC-compatible issuer so downstream services can be built against the same verified-principal contract
- [ ] T020 Implement the gateway's per-endpoint rate-limit configuration surface in `services/api-gateway/src/rate-limit/` per `contracts/api-standards.md` (no endpoint ships without a stated limit)

### Per-service scaffolding (9 domain services)

- [ ] T021 [P] Scaffold `services/identity-profile/` (NestJS + Prisma) with its own PostgreSQL database per `research.md` §4
- [ ] T022 [P] Scaffold `services/offer/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T023 [P] Scaffold `services/discovery-location/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T024 [P] Scaffold `services/participation/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T025 [P] Scaffold `services/messaging/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T026 [P] Scaffold `services/trust-safety/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T027 [P] Scaffold `services/entitlements-billing/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T028 [P] Scaffold `services/notification/` (NestJS + Prisma) with its own PostgreSQL database
- [ ] T029 [P] Scaffold `services/media/` (NestJS + Prisma) with its own PostgreSQL database, plus a storage-adapter interface with a local-filesystem dev implementation; the real S3-compatible provider is `[BLOCKED: ADQ-005]`

### Identity & Profile core (needed by every story's "a registered user" precondition)

- [ ] T030 [P] Create the `UserAccount` model + migration in `services/identity-profile/prisma/schema.prisma`: `dateOfBirth` (Highly Restricted, never in an API response or event), `ageAssuranceStatus` enum exactly `self_declared | liveness_passed | liveness_flagged_pending_id | id_verified | id_rejected_appeal_pending | restricted`, `accountStatus` enum `active | disabled`
- [ ] T031 [P] Create the `PublicProfile` model + migration: `firstName`, `photoAssetId`, `ageRangeLabel`, `interests: string[]`, `verificationStatus` enum `unverified | photo_verified | id_verified`, `languagePreference`, `publicRatingSummary` (average + count only, never individual feedback text)
- [ ] T032 [P] Create the `RegisteredAddress` model + migration: `city`, `country`, `calendarTimezone` (nullable placeholder pending the city→timezone mapping decision — spec Open Question 18)
- [ ] T033 [P] Create the `VerificationCase` model + migration: `kind` enum `photo_liveness | government_id`, `status` enum `submitted | passed | flagged | rejected | appeal_pending | appeal_upheld | appeal_denied`, `evidenceAssetId` (references Media, never stores the file itself)
- [ ] T034 [P] Create the `CityInterest` model + migration in `services/identity-profile/prisma/schema.prisma`: `userId`, `cityId`, `createdAt` — a user MAY have any number of rows (FR-023)
- [ ] T035 Implement the mandatory signup age-assurance flow in `services/identity-profile/src/verification/`: self-declared date of birth + mandatory photo-liveness check; if liveness flags a possible minor despite an 18+ self-declaration, require `VerificationCase(kind: government_id)` before the account's first offer can publish (FR-016)
- [ ] T036 Implement the manual appeal endpoint for a rejected government-ID upload or a disputed minor-flag in `services/identity-profile/src/verification/appeals.ts`: account's `ageAssuranceStatus` stays `id_rejected_appeal_pending`/`restricted` until the appeal resolves (FR-016 Clarifications)
- [ ] T037 [P] Implement CRUD endpoints for `CityInterest` in `services/identity-profile/src/city-interests/` (`POST/GET/DELETE /api/v1/city-interests`)
- [ ] T038 Implement `identity.city-interest-added` / `identity.city-interest-removed` event producers in `services/identity-profile/src/city-interests/` (extends `contracts/events.md`; needed so Discovery & Location can materialize a local join copy without a synchronous call per lookup) and `identity.user-eligibility-changed` per the existing contract in `contracts/events.md`

### Stub dependencies for cross-service publish flow (replaced with real logic in later stories)

- [ ] T039 [P] Scaffold `services/entitlements-billing/` internal endpoint `POST /internal/v1/entitlements/authorize` that always returns `granted` (real free-allowance/subscription logic is built in US5 — see T0xx below); this unblocks Offer's publish flow independently of US5
- [ ] T040 [P] Implement the FR-039 automated keyword/content-screening check in `services/trust-safety/src/screening/` and expose it as `POST /internal/v1/trust-safety/screen-offer`, called synchronously by Offer at publish time for every offer including high-risk categories (Clarifications round 5 — no human-review carve-out in v1)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Publish an immediate meet offer (Priority: P1) 🎯 MVP

**Goal**: A registered, age-eligible user can publish a meet offer, see it active for its configured lifetime, stop it early, and rebroadcast it after expiry.

**Independent Test**: Publish "Sunny wants to drink tea" at a named tea stall, see its active period, stop it before expiration (spec.md User Story 1).

### Tests for User Story 1

- [ ] T041 [P] [US1] Contract test for `POST /api/v1/offers` against `contracts/public/offer-service.md` in `services/offer/test/contract/publish-offer.spec.ts` (asserts default 15-min lifetime when `lifetimeMinutes` omitted, `201` response shape incl. `interestCount: 0`)
- [ ] T042 [P] [US1] Integration test for the full publish → active → expire lifecycle in `services/offer/test/integration/offer-lifecycle.spec.ts`
- [ ] T043 [P] [US1] Integration test asserting `422 CONTENT_SCREENING_FAILED` blocks a publish before any entitlement is reserved, in `services/offer/test/integration/screening-gate.spec.ts`

### Implementation for User Story 1

- [ ] T044 [US1] Create the `MeetOffer` model + migration in `services/offer/prisma/schema.prisma`: `activityText`, `place: { kind: pin|venue|live|moving, label?, lat, lng, geohash, rendezvousInstruction?, capturedAt }` with `rendezvousInstruction` **required** when `kind == moving` or the location is a queue-style spot without a fixed venue (FR-002), `lifetimeMinutes` integer **5-30, default 15** (FR-003), `capacity` integer **1-10, fixed at publish, immutable while active** (FR-008), `status` enum `active | expired | stopped`, `publishedAt`, `expiresAt`, `interestCount` int default 0, `screeningResult: { passed, ruleVersion, evaluatedAt }`, `rebroadcastOfCityOfferId` nullable self-reference
- [ ] T045 [US1] Implement `POST /api/v1/offers` in `services/offer/src/offers/offers.controller.ts`: validate activity + place (map pin via platform-default provider or live location required per FR-020), call Trust & Safety's `screen-offer` (T040) synchronously, then Entitlements & Billing's `authorize` (T039) synchronously, persist `MeetOffer` as `active` plus its `offer.published` outbox event only on both successes; release the entitlement reservation on any downstream failure
- [ ] T046 [US1] Implement `offer.published` event payload per `contracts/events.md`: `{ offerId, creatorUserId, cityId, placeGeohash, placeKind, activityText, lifetimeMinutes, capacity, publishedAt, expiresAt }` — **never** the exact `lat`/`lng`
- [ ] T047 [US1] Implement the server-authoritative expiry scheduler in `services/offer/src/offers/expiry-scheduler.ts`: transitions `active → expired` at `expiresAt` and emits `offer.expired` (FR-003, FR-010)
- [ ] T048 [US1] Implement `POST /api/v1/offers/{id}/stop` in `services/offer/src/offers/offers.controller.ts`: creator-only, `active → stopped`, emits `offer.stopped`, rejects if already inactive (FR-011)
- [ ] T049 [US1] Implement `GET /api/v1/offers/{id}` returning `interestCount` live while `status == active` (FR-042) and the creator-only exact-place field once selection has occurred (internal contract, not this public endpoint's default response)
- [ ] T050 [US1] Implement `GET /api/v1/offers` (creator-visible history) and `POST /api/v1/offers/{id}/rebroadcast` in `services/offer/src/offers/rebroadcast.ts`: always creates a **new** `MeetOffer` row (never reactivates the old one), which is a **new publish** and counts again toward the monthly allowance once T0xx (US5) replaces the stub (FR-012, FR-030)
- [ ] T051 [US1] Implement activity free-text acceptance without a fixed catalog, plus optional non-blocking activity/emoji suggestion metadata in `services/offer/src/offers/suggestions.ts` (FR-018, FR-021 — suggestions never required to publish)
- [ ] T052 [US1] Implement the `moneyPreference` field (`label` enum `creator_pays | byo | split | estimated_cost`, optional free-text `note` flagged `noteModerationStatus: pending`) in `services/offer/src/offers/offers.controller.ts` (FR-028)
- [ ] T053 [P] [US1] Add rate limiting to `POST /api/v1/offers` per `contracts/api-standards.md`'s rule that no endpoint ships without a stated limit

**Checkpoint**: User Story 1 is independently functional and testable (publish, view active period, stop, rebroadcast) using the Foundational stubs for entitlements and screening.

---

## Phase 4: User Story 2 - Receive a relevant live offer (Priority: P1)

**Goal**: A recipient with the offer's city registered as an interest, within its eligibility radius, sees the offer — prioritized when it matches their current location.

**Independent Test**: Recipient with Mumbai as a registered city interest and a current location near the offer sees it prioritized over comparable offers from a non-current registered city (spec.md User Story 2).

### Tests for User Story 2

- [ ] T054 [P] [US2] Integration test: recipient inside the 5 km eligibility radius with the matching city interest sees the offer; a recipient outside the radius does not, in `services/discovery-location/test/integration/eligibility.spec.ts` (FR-004, SC-002)
- [ ] T055 [P] [US2] Integration test: with two registered city interests, an offer matching the recipient's current-location city ranks ahead of an offer for the other registered city, in `services/discovery-location/test/integration/ranking.spec.ts` (FR-005, SC-003)

### Implementation for User Story 2

- [ ] T056 [P] [US2] Create the `LocationSnapshot` model + migration in `services/discovery-location/prisma/schema.prisma`: `userId`, `lat`, `lng`, `source` enum `live_gps | last_known`, `capturedAt`
- [ ] T057 [US2] Implement `PUT /api/v1/me/location` accepting a periodic device-GPS sample while the app is open, falling back to the last known location when live GPS is unavailable (FR-005)
- [ ] T058 [US2] Consume `identity.city-interest-added`/`removed` (T038) to materialize a local `CityInterest` join table in `services/discovery-location/prisma/schema.prisma`
- [ ] T059 [US2] Consume `offer.published`/`offer.stopped`/`offer.expired` (T046/T047/T048) to build the `DiscoveryEligibility` read model in `services/discovery-location/src/eligibility/`, storing only `placeGeohash` — never exact coordinates (constitution §3.IV)
- [ ] T060 [US2] Implement the eligibility rule in `services/discovery-location/src/eligibility/eligibility.service.ts`: recipient is eligible when `offer.status == active` AND recipient has `CityInterest.cityId == offer.cityId` AND `distance(recipient.LocationSnapshot, offer.placeGeohash) <= eligibilityRadiusKm[cityId]`, radius **defaulting to 5 km, configurable per city** (FR-004, resolved via `/speckit-clarify`)
- [ ] T061 [US2] Implement current-location-city ranking priority over other registered-city interests in `services/discovery-location/src/eligibility/ranking.service.ts` (FR-005, FR-023)
- [ ] T062 [US2] Implement `distanceBand` computation — exactly `<1km | 1-5km | 5-15km | 15km+` — as the only distance value ever returned (FR-026)
- [ ] T063 [US2] Consume `participation.interest-expressed` to maintain a denormalized `interestCount` on the read model (FR-042), never exposing `recipientUserId`
- [ ] T064 [US2] Implement `GET /api/v1/discovery/feed` with filters `activity`, `distance band`, `time remaining` (FR-022, Clarifications) and cursor pagination per `contracts/api-standards.md`
- [ ] T065 [P] [US2] Add rate limiting to `GET /api/v1/discovery/feed`

**Checkpoint**: User Stories 1 AND 2 both work independently — an offer published in US1 is correctly discoverable/ranked in US2.

---

## Phase 5: User Story 3 - Accept an offer and coordinate (Priority: P1)

**Goal**: An eligible recipient expresses interest; the creator selects; a shared chat opens for coordination; either party can cancel afterward.

**Independent Test**: Recipient expresses interest while active; creator selects; chat becomes available to both; post-expiry interest is rejected (spec.md User Story 3).

### Tests for User Story 3

- [ ] T066 [P] [US3] Contract test for `POST /api/v1/offers/{id}/expressions-of-interest` and `POST /api/v1/offers/{id}/selections` against `contracts/public/offer-service.md` in `services/participation/test/contract/`
- [ ] T067 [P] [US3] Integration test: expiring an offer mid-submission returns `409 OFFER_NOT_ACTIVE` and creates no chat, in `services/participation/test/integration/race-expiry.spec.ts` (Edge Cases)
- [ ] T068 [P] [US3] Integration test: creator selects fewer recipients than expressed interest — unselected recipient gets no non-selection notice, offer's `interestCount` stays visible to all viewers, in `services/participation/test/integration/partial-selection.spec.ts` (FR-008, FR-042, SC-020)

### Implementation for User Story 3

- [ ] T069 [P] [US3] Create the `ExpressionOfInterest` model + migration in `services/participation/prisma/schema.prisma`: `offerId`, `recipientUserId`, `message` optional short text, `createdAt`
- [ ] T070 [P] [US3] Create the `Selection` model + migration: `offerId`, `expressionOfInterestId`, `selectedAt`, `outcome` enum `pending | happened | cancelled`, `cancelledBy` enum `creator | recipient | null`; DB constraint `count(Selection where offerId=X and outcome != cancelled) <= MeetOffer.capacity`; `expressionOfInterestId` is **never swappable** once set (Clarifications)
- [ ] T071 [US3] Implement `POST /api/v1/offers/{id}/expressions-of-interest` in `services/participation/src/participation.controller.ts`: revalidate the offer is still `active` via Offer's internal contract at write time (not a cached read) before recording, rejecting with `409 OFFER_NOT_ACTIVE` otherwise (FR-007, FR-010)
- [ ] T072 [US3] Emit `participation.interest-expressed` per `contracts/events.md` on every accepted expression of interest
- [ ] T073 [US3] Implement `POST /api/v1/offers/{id}/selections` in `services/participation/src/participation.controller.ts`: creator-only, revalidate offer status + capacity remaining, reject with `409 CAPACITY_REACHED`/`409 OFFER_NOT_ACTIVE`, idempotent via `Idempotency-Key` (FR-008)
- [ ] T074 [US3] Emit `participation.participant-selected` on every accepted selection
- [ ] T075 [US3] Implement the FR-027 zero-selection outcome: on `offer.expired`, if an offer has zero non-cancelled selections, tell each interested recipient it expired without selection; a **partial** selection sends no such notice (FR-008, resolved via `/speckit-clarify`)
- [ ] T076 [P] [US3] Create the `Chat`, `ChatMembership`, and `Message` models + migrations in `services/messaging/prisma/schema.prisma`: `Chat.status` enum `active | archived_readonly`
- [ ] T077 [US3] Consume `participation.participant-selected` in `services/messaging/src/chat-creation.consumer.ts` to create the one shared group chat (creator + all selected recipients) idempotently by `selectionId` — a redelivered event MUST NOT create a duplicate chat (FR-009)
- [ ] T078 [US3] Implement `GET /api/v1/conversations` and `GET/POST /api/v1/conversations/{id}/messages` in `services/messaging/src/messaging.controller.ts`, authorized to chat members only
- [ ] T079 [US3] Implement the FR-038 cancellation flow: either party (or the creator revoking, treated identically) can cancel a `Selection`; `outcome → cancelled`, `Chat.status → archived_readonly` (never deleted), and the other party gets a push + in-app notification, in `services/participation/src/cancellation.ts`
- [ ] T080 [US3] Emit `participation.selection-resolved` (`outcome: happened | cancelled`) on every terminal Selection state change
- [ ] T081 [US3] Implement `GET /internal/v1/offers/{offerId}/place` in `services/offer/src/offers/internal.controller.ts`: returns the exact place (incl. `rendezvousInstruction`) only to the creator and a party with an accepted `Selection` on that offer — never broadcast on an event (FR-002)

**Checkpoint**: User Stories 1, 2, and 3 together deliver the full core discover → interest → select → chat journey.

---

## Phase 6: User Story 4 - Build trust through post-meeting feedback (Priority: P2)

**Goal**: After a qualifying (non-cancelled) meeting, participants can rate and give feedback; public trust info appears on profiles; inappropriate feedback can be reported.

**Independent Test**: After a qualifying meeting, each participant submits a rating/feedback; the approved public rating is visible to future users; a participant can report inappropriate feedback/photos (spec.md User Story 4).

### Tests for User Story 4

- [ ] T082 [P] [US4] Integration test: a feedback photo showing another identifiable person is withheld from public visibility until that person's consent record exists, in `services/trust-safety/test/integration/photo-consent.spec.ts` (FR-029)
- [ ] T083 [P] [US4] Integration test: the rating prompt fires exactly 2 hours after `participation.selection-resolved(outcome: happened)`, never instantly, in `services/trust-safety/test/integration/rating-delay.spec.ts`

### Implementation for User Story 4

- [ ] T084 [P] [US4] Create the `RatingFeedback` model + migration in `services/trust-safety/prisma/schema.prisma`: `offerId`, `selectionId`, `raterUserId`, `rateeUserId`, `starRating`, `writtenFeedback`, `photoUrl?`, `photoConsent: { subjectUserId, consentedAt }[]`, `visibility` enum `pending_followup | public | removed`, `promptSentAt`
- [ ] T085 [US4] Consume `participation.selection-resolved` in `services/trust-safety/src/rating-eligibility.consumer.ts`: on `outcome == happened`, create the `RatingFeedback` eligibility record and schedule the async prompt job for exactly 2 hours later (FR-029, resolved via `/speckit-clarify`)
- [ ] T086 [US4] Implement `POST /api/v1/ratings` in `services/trust-safety/src/ratings.controller.ts`: accepts star rating, written feedback, optional photo; a photo showing another identifiable person is **not** made public without that person's explicit in-app consent captured before publication (FR-029)
- [ ] T087 [US4] Emit `trust.rating-submitted` only on a visibility transition to `public` (never on initial submission), consumed by Identity & Profile to refresh `PublicProfile.publicRatingSummary` (average + count only)
- [ ] T088 [P] [US4] Create the `Block` model + migration: `sourceUserId`, `targetUserId`, `status` enum `pending_review | enforced | rejected`
- [ ] T089 [P] [US4] Create the `Report` model + migration: `reporterUserId`, `subjectType` enum `user | offer | message | rating_feedback | photo`, `subjectId`, `status`
- [ ] T090 [US4] Implement `POST /api/v1/blocks` in `services/trust-safety/src/blocks.controller.ts`: routes to `pending_review`, but the submitter's own read-model view excludes `targetUserId` immediately regardless of review outcome (FR-015, Clarifications)
- [ ] T091 [US4] Implement `POST /api/v1/reports` in `services/trust-safety/src/reports.controller.ts`; report content is never exposed to any user as profile information (constitution §3.V)
- [ ] T092 [P] [US4] Create the `TrustedContactSetting` model + migration: `contactHandleEncrypted` (encrypted at rest, Highly Restricted, never in a list/discovery response)
- [ ] T093 [US4] Implement `GET/POST /api/v1/trusted-contacts` in `services/trust-safety/src/trusted-contacts.controller.ts`
- [ ] T094 [US4] Implement `trust.moderation-decisioned` producer for block/report review outcomes, consumed by Identity & Profile (enforcement) and Offer (unpublish on a reversed screening decision)

**Checkpoint**: All P1 + this P2 story are independently functional.

---

## Phase 7: User Story 5 - Publish within a free allowance or subscription (Priority: P2)

**Goal**: A non-subscribing user sees their remaining free monthly broadcasts, is blocked at the limit with purchase/subscription options, and an active subscription removes the limit.

**Independent Test**: Publish three offers in one month; a fourth is blocked without a subscription; each subscription period allows unlimited publishing while active (spec.md User Story 5).

### Tests for User Story 5

- [ ] T095 [P] [US5] Integration test: three successful publishes consume the free allowance 2 → 1 → 0; a fourth returns `402 ENTITLEMENT_REQUIRED`, in `services/entitlements-billing/test/integration/free-allowance.spec.ts` (SC-013)
- [ ] T096 [P] [US5] Integration test: stopping or letting an offer expire does not refund its allowance slot; a rebroadcast consumes a new slot, in `services/entitlements-billing/test/integration/no-refund.spec.ts` (FR-030, resolved via `/speckit-clarify`)
- [ ] T097 [P] [US5] Integration test: an active subscription bypasses the free-allowance check; cancelling preserves entitlement only through the current paid period with no refund, in `services/entitlements-billing/test/integration/subscription.spec.ts` (FR-032, SC-016)

### Implementation for User Story 5

- [ ] T098 [US5] Create the `PublishingEntitlementLedger` model + migration in `services/entitlements-billing/prisma/schema.prisma`: `userId`, `calendarMonthKey` (derived from `RegisteredAddress.calendarTimezone`, placeholder pending Open Question 18), `freeOffersUsedThisMonth` int **cap 3**, `entries[]: { offerId, entitlementSource: free_allowance|one_time_purchase|subscription, reservedAt, releasedAt? }`
- [ ] T099 [US5] Replace the Foundational always-`granted` stub (T039) with real logic in `services/entitlements-billing/src/authorize.ts`: reserve free allowance, a one-time purchase, or an active subscription atomically; **every successful publish increments `freeOffersUsedThisMonth` and it is never decremented**, regardless of the offer's later outcome; a rebroadcast increments it again (FR-030, resolved)
- [ ] T100 [P] [US5] Create the `Subscription` model + migration: `plan` enum `weekly | monthly | yearly`, `status` enum `active | cancelled_pending_period_end | expired`, `currentPeriodEnd`, `basePriceMinor`, `discountPct` (**10 for monthly, 20 for yearly, 0 for weekly** — FR-037), `currency`
- [ ] T101 [P] [US5] Create the `OneTimeBroadcastPurchase` model + migration: `priceMinor`, `currency`, `status` enum `granted | consumed`, `consumedByOfferId?`
- [ ] T102 [US5] Implement `GET /api/v1/entitlements` (remaining allowance + subscription state, FR-031, FR-034) in `services/entitlements-billing/src/entitlements.controller.ts`
- [ ] T103 [US5] Implement `POST /api/v1/subscriptions` and `POST /api/v1/subscriptions/{id}/cancel` in `services/entitlements-billing/src/subscriptions.controller.ts`: cancellation takes effect at `currentPeriodEnd`, entitlement continues until then, no refund (FR-032)
- [ ] T104 [US5] Implement `POST /api/v1/broadcast-purchases` (the USD-1-equivalent one-time purchase) in `services/entitlements-billing/src/purchases.controller.ts`
- [ ] T105 [BLOCKED: ADQ-004] Integrate real platform in-app-purchase (Apple/Google) server-side receipt verification in `services/entitlements-billing/src/payment-webhook/`; until approved, purchase/subscription endpoints operate against a dev-only mock verifier behind the same interface
- [ ] T106 [US5] Emit `billing.subscription-changed` and `billing.one-time-broadcast-granted` per `contracts/events.md`, consumed by Notification to confirm the state change to the user

**Checkpoint**: All 5 user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Concerns that span every story rather than belonging to one.

- [ ] T107 [P] Implement device-locale-based UI text with a user override and English fallback in `apps/stranger_flutter/lib/l10n/`; error `messageKey`s from every service resolve through the same translation catalog (FR-040, ADR-004)
- [ ] T108 [P] Wire push notifications via FCM in `services/notification/src/push/` targeting the ~30-second delivery goal (FR-006), with the in-app live feed as the fallback when push permission is denied
- [ ] T109 [P] Add audit-event logging (separate from application logs) for every moderator/admin action — block/report resolution, screening override, verification appeal decision (constitution §7)
- [ ] T110 [P] Add automated schema-conformance (contract) tests for every file under `contracts/public/` and `contracts/internal/`, wired into CI (`research.md` §11)
- [ ] T111 [P] Run and pass every scenario in `specs/quickstart.md` end-to-end against the assembled system, including the idempotency and event-redelivery cross-cutting checks
- [ ] T112 [P] Security hardening pass: confirm every endpoint in `contracts/api-standards.md`'s Initial Public Resource Boundary has an explicit, enforced rate limit
- [ ] T113 Update `docs/architecture/decisions.md`'s Open Decisions table as each `[BLOCKED: ADQ-xxx]` task above is unblocked by an approval

---

## Phase 9: Browser (Flutter Web) Parity

**Added 2026-09-10** when a product decision moved browser access from "architecturally supported, unscheduled" into v1 scope (FR-041, resolved; `research.md` §14; `docs/architecture/decisions.md` ADR-001 amendment). **Purpose**: bring every story already built for mobile to full parity in a desktop/laptop/Chromebook browser, reusing the same Flutter codebase and the same REST/event contracts — no new backend work, only client-side platform handling.

- [ ] T114 [P] Enable and verify the Flutter Web build target for `apps/stranger_flutter/` (`flutter config --enable-web`, `flutter build web`) alongside the existing Android/iOS targets (extends T003)
- [ ] T115 [P] Add a `flutter build web` job to the CI pipeline in `.github/workflows/ci.yml` (extends T007)
- [ ] T116 Implement a responsive layout/breakpoint system in `apps/stranger_flutter/lib/layout/` so every existing screen (US1-US5) adapts across phone, tablet, and desktop-browser widths without a duplicate per-platform screen
- [ ] T117 [US2] Implement platform-abstracted location acquisition in `apps/stranger_flutter/lib/location/`: native GPS on mobile, the browser Geolocation API on web, both feeding `PUT /api/v1/me/location` (T057) and both applying FR-005's identical last-known-location fallback when a live reading isn't available this session
- [ ] T118 Implement platform-abstracted notification handling in `apps/stranger_flutter/lib/notifications/`: FCM push on mobile (T108), web push where the browser supports it, with the in-app/in-browser live feed as the universal fallback (FR-006) — a browser that can't support push still gets a working, non-degraded experience via the fallback, never a silently missed notification
- [ ] T119 [P] Add browser-based E2E tests (Playwright, per `research.md` §11) covering Stories 1-5 against the Flutter Web build, in `apps/stranger_flutter/test/web_e2e/`
- [ ] T120 Run `specs/quickstart.md`'s Browser Parity cross-cutting check against a supported desktop browser, confirming identical outcomes to the mobile run in Phases 3-7
- [ ] T121 Document the supported-browser/version matrix (default working assumption: latest stable Chrome, Safari, Firefox, Edge) and the applicable accessibility standard in `docs/architecture/decisions.md`, finalizing once ADQ-008 is approved — this documentation task is not itself blocked, only the final sign-off is

**Checkpoint**: All 5 user stories are usable end-to-end in a supported browser with no feature gap versus the mobile app.

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
