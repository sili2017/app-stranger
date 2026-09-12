# Implementation Plan: Ephemeral Stranger Meet Offers

**Branch**: `001-stranger-meet-offers` (not yet checked out; work-in-progress artifacts currently live on `main`) | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/spec.md` and the project constitution from `/.specify/memory/constitution.md`. A second technical-analyst review (external input) proposed an initial architecture sketch; it was reconciled against the ratified constitution and the current spec (its spec path and FR range had drifted — `specs/spec.md` is the real path, and the spec now runs through FR-039) before being incorporated below.

**Status**: Architecture and design baseline for Phase 0/1. Not approved for `/speckit-tasks` or implementation until the blocking gates in the Constitution Check are resolved.

## Summary

Stranger lets a registered adult publish a short-lived (5-30 minute, default 15) offer to do an activity at a specific, selected, live, or moving place. Recipients who have the offer's city registered as an interest and are within an eligibility radius discover it (nearest-current-location offers prioritized), express interest, and the creator selects up to a fixed capacity (1-10, set at publish time) to unlock one shared group chat for coordination. A non-subscribing user gets three free broadcasts per calendar month (by registered-address city); beyond that, a one-time purchase or an auto-renewing subscription (weekly/monthly/yearly, 10%/20% discounts) is required.

Per the constitution, the technical approach is a frontend-neutral platform: Flutter clients (Android/iOS phones and tablets; responsive web is architecturally supported but not yet in release scope) talk only to a versioned REST API gateway, which routes to a layered set of domain-aligned Node.js/TypeScript microservices, each owning its own PostgreSQL data, with Redis for caching/rate-limiting/ephemeral coordination and a durable event bus for cross-service domain events. Python is reserved for separately approved AI use cases (e.g., moderation, translation) only.

## Technical Context

**Language/Version**: Dart (Flutter) for clients; Node.js (current LTS) + TypeScript for all backend services; Python (current stable) reserved for approved AI services only. Exact version pins are recorded in `research.md`.

**Primary Dependencies**: Backend framework, schema-validation/OpenAPI tooling, and ORM/migration tooling for the Node/TypeScript services are selected in `research.md` (recommendation: NestJS + Zod/class-validator + Prisma) so that all nine domain services share one convention instead of each choosing independently.

**Storage**: PostgreSQL, one database (or strictly isolated schema + credentials) per owning microservice; Redis for cache, rate limiting, and ephemeral coordination (non-authoritative); managed cloud object storage (mechanism resolved 2026-09-12 via `/speckit-clarify`, ADQ-005 — specific vendor still open, see `research.md` §6) for verification documents and feedback/profile media.

**Testing**: `flutter_test`/`integration_test` for Dart; Jest (or Vitest) + Supertest for Node/TypeScript unit and API tests; OpenAPI-schema conformance (contract tests) for every public and inter-service contract; Playwright (web) and a mobile E2E runner (Maestro/Detox) for the critical cross-client journeys (publish → discover → interest → select → chat).

**Target Platform**: Android and iOS phones/tablets, AND a desktop/laptop/Chromebook browser via Flutter Web — both ship in v1 with full feature parity (FR-041, resolved 2026-09-10: browser access is in v1 scope, not deferred). Native desktop packaging (Windows/macOS/Linux installable apps, as opposed to browser access) remains deferred; browser access already covers desktop/laptop use without installing anything.

**Project Type**: Multi-client, microservices-based product platform (mobile-first).

**Performance Goals**: NEEDS CLARIFICATION — spec.md defines only one numeric target (FR-006: push-notification delivery within ~30 seconds of publish). No p95 API latency, discovery-feed refresh interval, or concurrent-user target is defined anywhere in the spec or constitution. `research.md` proposes provisional targets to unblock architecture and contract design; the product owner must confirm them before they become binding release NFRs.

**Constraints**: Adult-only access (FR-016); offers are time-bound (5-30 min, FR-003); location-sensitive but privacy-preserving discovery (distance bands pre-selection, precise location disclosed only after selection, single location snapshot at publish for moving/transient places — FR-002, FR-026, Clarifications); external payment and identity-verification integrations; frontend-neutral API — no client accesses a service database or holds domain rules directly (constitution §4); localization by device locale with override and fallback (constitution §5).

**Scale/Scope**: Initial delivery covers only the `001-stranger-meet-offers` journeys (User Stories 1-5 in spec.md). No initial active-user count, city count, message volume, or moderation-volume assumption is supplied anywhere — NEEDS CLARIFICATION before real capacity planning; `research.md` records placeholder assumptions used only to size the reference architecture, not to size infrastructure.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (see "Post-Design Re-Check" below).*

| Gate | Status | Evidence / Required Action |
| --- | --- | --- |
| Requirements trace to stories & acceptance scenarios (§2, §6) | PASS | spec.md defines FR-001 through FR-042 (FR-040/FR-041 added for localization/platform-support; FR-042 added for the public live interest-count — all three closing gaps surfaced during planning/`/speckit-clarify`), five prioritized user stories with independent acceptance scenarios, and SC-001 through SC-020. |
| Frontend-neutral, versioned REST architecture (§4) | PASS | A single API gateway exposes versioned REST contracts (`/api/v1`); no client accesses a service database or secret directly. |
| Technology stack matches constitution (§4) | PASS | Flutter/Dart clients, Node.js/TypeScript services, PostgreSQL per service, Redis, Docker, GitHub Actions, GitHub, Sentry — no substitutions proposed. |
| Layered, domain-aligned microservice architecture with explicit ownership (§5) | PASS | Client / API-edge / domain-services / platform layers are defined below; every service lists what it owns and explicitly does not own. |
| Real-world connection with informed consent (§3.I) | PARTIAL | Pre-selection profile fields (FR-013) and post-selection place disclosure (FR-002) are specified; the consent-capture flow for an identifiable-person feedback photo (FR-029) still needs a concrete UX/data-model treatment. |
| Safety, privacy, adult-only readiness for release (§3.II, §9) | PARTIAL, improved from BLOCKED | Moderation review turnaround (4 hours) is resolved and already implemented (`moderation.service.ts`); auth mechanism is resolved (ADQ-002a, managed OIDC, ADR-007), though the vendor migration off `x-dev-user-id`/`DevOidcIssuer` is unstarted. Data retention (chat/reports/moderation cases: 12 months, legal-hold override) is resolved 2026-09-12 via `/speckit-clarify` but not yet implemented (no purge job exists); the abuse-prevention rate-limit table is resolved and already implemented (`rate-limit.config.ts`). Still open: age-assurance appeal SLA specifics, ongoing re-verification cadence, and v1 launch countries (ADQ-002b, spec.md Open Questions 1, 18). No code implementing the still-gated behaviors may ship until these are resolved (constitution §9). |
| Time-bound offers are honest and unambiguous (§3.III) | PASS | Offer lifecycle (active/stopped/expired), 15-minute default, 5-30 minute creator range, and countdown-start rule are fully specified (FR-003, FR-017). |
| Location relevance without unnecessary exposure (§3.IV) | PARTIAL | Distance-band-before-selection, single-location-snapshot, and the default eligibility radius (5 km, configurable per city) are specified; GPS sampling interval and last-known-location staleness thresholds are still open (spec Open Question 4). |
| Trust signals fair, consented, reviewable (§3.V) | PARTIAL, improved from PARTIAL | Consent-before-publish for an identifiable-person photo, the rating follow-up delay (2 hours), and the 1-5 star rating scale are all resolved and already implemented. Rating visibility (mutual → immediate; one-sided → 5-day SLA then public) and a self-service offer-screening appeal path are resolved 2026-09-12 via `/speckit-clarify` but **not yet implemented** — the counterpart-rating/SLA check, the appeal endpoint, and its review workflow are new work (see `data-model.md`'s `RatingFeedback` and spec.md FR-039). |
| Payments/subscriptions implementation-ready (§4, §7) | PARTIAL, improved from BLOCKED for release | Payment mechanism is resolved — Stripe, identically on mobile and web (ADQ-004, ADR-009), replacing the prior platform-IAP-only assumption that had no web equivalent. Still open: base subscription prices, tax handling, and refund/restore rules (Open Questions 20-22). Billing contracts can now be designed against a single concrete processor instead of a placeholder. |
| Event transport and operational SLOs approved (§5) | PARTIAL, improved from OPEN | Event-bus technology is resolved — self-hosted Kafka (ADQ-001, ADR-008). Operational SLOs (peak concurrent users, p95 targets, recovery objectives) remain open (ADQ-007, deferred — needs real traffic/business forecasts, not an architecture pick). |

**Decision**: Proceed to Phase 0/1 (research, data model, contracts, quickstart) using the requirements that are already fixed as the source of truth. Per constitution §9, no `/speckit-tasks` item that implements a still-gated safety, payment, or event-transport decision may be executed until that decision is resolved by the product owner (and, where noted, architecture approval) — `/speckit-tasks` must mark those tasks blocked rather than silently inventing an answer. As of 2026-09-12, five of the seven previously-blocking architecture decisions (auth mechanism, event-bus technology, payment mechanism, storage mechanism, browser/accessibility matrix) are resolved via `/speckit-clarify` — see `docs/architecture/decisions.md` ADR-006 through ADR-010. What remains gated is narrower: two vendor picks (auth, storage), pricing specifics (payments), and two genuinely deferred product/compliance decisions (ADQ-002b, ADQ-007).

## Project Structure

### Documentation (this feature)

```text
specs/
├── spec.md               # Feature specification (/speckit-specify, /speckit-clarify)
├── plan.md               # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── readiness.md      # Requirements-quality gate (/speckit-checklist)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

This feature's artifacts live directly under `specs/` (confirmed as the correct, intentional layout for this repository) rather than under a further `specs/001-stranger-meet-offers/` subdirectory.

### Source Code (repository root)

```text
apps/
├── stranger_flutter/              # Android, iOS, tablet, and responsive-web client (single Flutter codebase)
└── admin_web/                     # Optional moderator/admin UI; separate release approval required, not built in this feature

services/
├── api-gateway/                   # AuthN, global rate limits, telemetry correlation, routes to owning services
├── identity-profile/              # Accounts, adult-eligibility state, profile, verification display, city interests
├── offer/                         # Offer lifecycle: create/stop/expire/rebroadcast, capacity, place reference
├── discovery-location/            # Location-permission state, distance bands, eligibility + proximity ranking, feeds
├── participation/                 # Expressions of interest, creator selection, non-selection outcomes
├── messaging/                     # Chat creation after selection, membership, message lifecycle
├── trust-safety/                  # Block/report, moderation cases, rating/feedback moderation state, trusted contacts
├── entitlements-billing/          # Free-allowance counting, one-time purchase, subscription state, payment audit
├── notification/                  # Push/in-app delivery jobs, templates, retry/idempotency
└── media/                         # Uploaded media metadata, malware/format checks, expiring delivery URLs

python-services/
└── ai-safety/                     # Placeholder only — created when an AI moderation/translation use case is separately approved; empty in this feature

contracts/
├── public/                        # Versioned OpenAPI specs for the client-facing gateway API
├── internal/                      # Inter-service REST contracts
└── events/                        # Versioned domain-event schemas (see specs/contracts/ for the Phase 1 draft)

packages/
├── ts-platform/                   # Shared non-domain TypeScript concerns only (logging, error shapes, auth middleware)
├── dart-design-system/            # Shared Flutter UI components/theme
└── test-fixtures/                 # Shared contract/test fixtures across services

infra/
├── docker/
├── environments/
├── migrations/                    # Per-service migration orchestration, never a shared schema
└── observability/                 # Sentry, structured logging, tracing, metrics wiring

docs/
├── product/
├── requirements/
└── architecture/
```

**Structure Decision**: A monorepo hosts shared contracts, coordinated CI/CD, and product documentation while keeping each service independently deployable with exclusive data ownership (constitution §5). The `services/` split above mirrors the nine domain services in the Solution Architecture section — it does not create a shared domain-model package or any direct cross-service database access. `python-services/ai-safety` is scaffolded as an empty placeholder only; no AI capability is implemented or assumed by this plan.

## Solution Architecture

```text
Flutter phone/tablet         Flutter Web (ships in v1, full parity)
          \                         /
           \                       /
            +-- HTTPS + REST v1 --+
                       |
            API Gateway / Client API
            (token validation: managed OIDC, ADR-007)
                       |
     +-----------------+-----------------+
     |                 |                 |
Identity & Profile  Offer            Discovery & Location
     |                 |                 |
     +---------- domain-event boundary (self-hosted Kafka, ADR-008) ----------+
     |                                                          |
Participation   Messaging   Trust & Safety   Entitlements & Billing
     |                                                          |
Notification    Media       PostgreSQL (1 per service)   Redis
                    |                     |
        managed cloud object storage      Stripe (ADR-009)
             (ADR-010)
                                          |
                        Sentry + structured logs + metrics + traces + audit events
```

### Layer 1 — Client Experience

- A single Flutter codebase serves Android/iOS phones and tablets AND a responsive Flutter Web build for desktop/laptop/Chromebook browsers — both ship in v1 with full feature parity (FR-041). The same codebase branches on platform (`kIsWeb`) only where a browser API genuinely differs from a native one (geolocation permission model, notification delivery — see the Security and Privacy Architecture note below), never to withhold a feature on one platform.
- Locale defaults to the device locale, with an in-app override and an English fallback (constitution §5); backend-generated system messages honor the user's saved language preference.
- Clients call only the gateway's versioned public REST contracts and hold no entitlement, matching, or moderation policy — only presentation, local state, accessibility, and offline-safe UI behavior.

### Layer 2 — API/Edge

- The **API Gateway / Client API** authenticates every request, applies global rate limits, correlates telemetry with a request ID, exposes `/api/v1`, and routes to the owning domain service.
- The gateway never becomes a business-logic service; authorization stays with the domain service that owns the resource being acted on.
- OpenAPI contracts are client-agnostic; user-created content (activity text, chat, interest messages) is never auto-translated in this scope (constitution §5).

### Layer 3 — Domain Microservices

| Service | Owns | Primary Responsibilities | Does Not Own |
| --- | --- | --- | --- |
| Identity & Profile | Account, adult-eligibility state, profile, verification display, language preference, registered-address city, city interests | AuthN integration, profile visibility rules, verification-workflow orchestration, age/access enforcement (FR-016) | Government-ID document storage internals (delegated to Media + a verification vendor), offers, ratings |
| Offer | Offer, activity, place reference, status, lifecycle, rebroadcast, creator history | Create/stop/expire/rebroadcast offers (FR-001, FR-003, FR-011, FR-012); enforce allowed state transitions (FR-017) | Recipient ranking, interest/selection, billing records |
| Discovery & Location | Location-permission state, recipients' own current-location snapshots, distance bands, discovery projections | City-interest + radius eligibility (FR-004), proximity ranking (FR-005, FR-023), nearby/city feeds and filters (FR-022) | The offer's place record itself (owned by Offer; Discovery & Location only ever holds a truncated geohash derived from it — see `data-model.md`), precise-location disclosure decision, offer lifecycle authority |
| Participation | Expression of interest, selection, participation capacity | Interest message (FR-025), creator selection up to fixed capacity (FR-008), zero-selection outcome (FR-027; a partial selection sends no explicit non-selection notice — FR-008), emits `participation.interest-expressed`/`participant-selected` events that Offer and Discovery & Location consume to maintain the public live interest count (FR-042) | Offer lifecycle, chat data |
| Messaging | Chat, membership, messages | Create the shared group chat after a selection (FR-009), conversation authorization, read-only/archive on cancellation (FR-038) | Selection decision, rating rules |
| Trust & Safety | Blocks, reports, moderation cases, rating/feedback content + moderation state, trusted-contact settings | Block/report flow with immediate own-view update pending review (FR-015), automated content screening at publish (FR-039), emergency guidance, feedback consent/visibility (FR-029) | Identity-document verification, payment entitlement |
| Entitlements & Billing | Free-broadcast allowance, one-time purchase, subscription entitlement, payment-event audit | Apply the 3-free-offers/month rule (FR-030), atomically authorize broadcast entitlement, subscription state incl. cancel-at-period-end (FR-032) | External payment card data, offer content |
| Notification | Delivery preferences, notification jobs, delivery status | Service-triggered push/in-app delivery within the ~30s target (FR-006), localized templates, retry/idempotency | Feed ranking, offer state authority |
| Media | Uploaded profile/feedback/verification media metadata and access grants | Malware/format checks, consent/moderation handoff, expiring delivery URLs | Public-feedback policy, identity-verification decision |

**Integration boundary**: an identity-verification vendor, a managed OIDC-as-a-service auth provider (ADQ-002a, ADR-007), Stripe as the payment processor (ADQ-004, ADR-009), a map provider (Apple Maps on iOS / Google Maps on Android, per FR-020), a managed cloud object-storage provider (ADQ-005, ADR-010), a push provider, and self-hosted Kafka as the durable event bus (ADQ-001, ADR-008) are external integrations, not product-domain services — each is isolated behind an adapter so no client or domain service depends on a vendor API directly.

### Layer 4 — Platform and Integrations

- PostgreSQL is isolated per service (own database or strictly isolated schema + credentials); no service queries another service's owned tables.
- Redis handles rate limiting, cacheable discovery read models, and short-lived coordination; it is never the system of record for offer, entitlement, participation, or audit state.
- Self-hosted Kafka (ADQ-001, resolved 2026-09-12, `docs/architecture/decisions.md` ADR-008) carries domain events such as `offer.published`, `offer.stopped`, `offer.expired`, `participation.interest-expressed`, `participation.participant-selected`, `billing.subscription-changed`, `trust.rating-submitted`, and `trust.moderation-decisioned` (full list and payload shapes in `contracts/events.md`), using a transactional outbox and idempotent consumers (constitution §5) so a redelivered event cannot create a duplicate chat, charge, or notification. Event payloads are minimized per consumer need — `offer.published` carries only a truncated geohash, never the offer's exact coordinates (`contracts/events.md`'s Payload Minimization Rule). The current implementation targets a dev-only Redis-based pub/sub substitute (`packages/ts-platform/src/events/`); the Kafka migration itself is unstarted.
- Sentry captures errors with a PII-safe configuration; structured logs, traces, metrics, and audit events share a correlation ID and exclude or redact chat content, verification material, payment data, and precise location.

## Critical Cross-Service Flows

### Publish an offer
1. Client submits an offer draft to the gateway; the gateway authenticates the request.
2. Offer validates the activity/place and asks Entitlements & Billing to authorize a broadcast.
3. Entitlements & Billing atomically reserves free allowance, a one-time purchase, or active-subscription entitlement; Offer persists the active offer plus an outbox event; a failed publish releases any unused reservation.
4. Discovery & Location consumes `offer.published` (geohash only, never exact coordinates), updates the eligible read model; Notification creates delivery jobs targeting eligible recipients within ~30 seconds.
5. The client receives the offer's active state and the caller's updated remaining allowance/entitlement.

### Express interest and select
1. Discovery & Location returns an active offer with a distance band, its live `interestCount` (FR-042), and the approved pre-selection profile fields (FR-013).
2. Participation revalidates the offer is still active via Offer's contract, then records the expression of interest with its optional short message (FR-025). The resulting `participation.interest-expressed` event lets Offer and Discovery & Location each bump their own denormalized `interestCount` — no synchronous call back to either service is needed just to keep the count current.
3. Only Participation performs creator selection, after revalidating offer status and the creator's authorization, up to the fixed capacity (FR-008). An interested recipient who is not selected receives no explicit non-selection notice while capacity fills partially — only a fully unselected offer (FR-027) gets an explicit outcome message.
4. `participation.participant-selected` triggers Messaging to create the one shared group chat (FR-009) and Notification to inform all parties; idempotent consumption prevents a duplicate chat from a redelivered event. If a party later needs the offer's exact place (post-selection reveal, FR-002, including the `rendezvousInstruction` for a moving/queue-style place), the client fetches it via Offer's scoped internal contract — it is never carried on the event itself.

### Stop or expire an offer
1. Offer is stopped by its creator, or expires at authoritative server time, and writes an outbox event (`offer.stopped` / `offer.expired`).
2. Discovery & Location removes it from active read models; Participation rejects new interest (FR-010); Notification sends the approved status outcome, including "expired without selection" (FR-027). No entitlement reversal happens here — the publish already permanently consumed its allowance/entitlement slot regardless of how the offer ends (FR-030, resolved).

### Subscription and one-time purchase
1. Client receives location/country-configured prices from Entitlements & Billing via the gateway.
2. A payment/store integration confirms a purchase through a server-side webhook/verification flow; raw payment credentials never reach a Stranger service.
3. Entitlements & Billing records an auditable subscription or one-time entitlement and emits `billing.subscription-changed` or `billing.one-time-broadcast-granted`.
4. Publishing always calls Entitlements & Billing as the single authority; a client-reported purchase status is never trusted on its own.

### Post-meetup rating visibility (resolved 2026-09-12, not yet implemented)
1. `promptSentAt`'s existing 2-hour delayed job (FR-029) still triggers the rating prompt to both parties as today.
2. **New**: on each `POST /api/v1/ratings` submission, Trust & Safety checks whether the counterpart (`raterUserId`/`rateeUserId` swapped, same `selectionId`) has also rated. If so — and the photo-consent gate (unchanged) is satisfied — both become `public` immediately.
3. **New**: a scheduled job (same delayed-job pattern as `promptSentAt`) fires 5 days after `promptSentAt` for any `RatingFeedback` still `pending_followup` with no counterpart rating, and flips it to `public` on its own.
4. No new cross-service calls are introduced — this is entirely internal to Trust & Safety's own `RatingFeedback` table.

### Offer-screening appeal (resolved 2026-09-12, not yet implemented)
1. `POST /api/v1/offers` rejects with `422 CONTENT_SCREENING_FAILED` as today (FR-039); the offer is never persisted as active.
2. **New**: Offer records the rejection (activity text, rule version, timestamp) so a creator can appeal it — mirroring `VerificationCase`'s existing appeal shape (`SubmitAppealDto` in Identity & Profile) rather than a new pattern.
3. **New**: a `POST .../appeals`-style endpoint (owning service TBD at task-breakdown time — likely Trust & Safety, which already owns `internal/v1/trust-safety/screening-overrides`) lets the creator submit that appeal; a moderator resolves it via the existing override endpoint, now reachable from a real user action instead of only ad hoc moderator-initiated review.
4. No event contract changes — this reuses Trust & Safety's existing moderation-case decision shape (`enforced | rejected | appeal_upheld | appeal_denied`).

### Data retention purge (resolved 2026-09-12, not yet implemented)
1. **New**: a recurring job (per service — Messaging for `Chat`/`Message`, Trust & Safety for `Report`/`ModerationCase`) finds records whose closing timestamp (`archived_readonly` for chats, case-resolution for reports) is more than 12 months old and has no active legal/safety hold, then deletes or anonymizes them (FR-015, FR-038).
2. No cross-service event is needed — retention is enforced entirely within the owning service, consistent with each service's exclusive data ownership (constitution §5).

### Emergency guidance and trusted-contact sharing (resolved 2026-09-12, not yet implemented)
1. Emergency guidance is a static, always-accessible client screen — no backend call at all, just bundled safety copy (confirm the meeting place, tell someone, contact local emergency services).
2. **New**: a manual, one-tap client action calls a new Trust & Safety endpoint (alongside the existing `trusted-contacts` settings controller) that looks up the caller's `TrustedContactSetting`, decrypts it server-side, and sends that contact the current offer's activity/place/time once (via Notification or a direct out-of-band channel — mechanism TBD at task-breakdown time). Not automatic or continuous; nothing repeats after the one send.

## Security and Privacy Architecture

- Adult-only access is enforced at Identity & Profile and re-checked at every sensitive endpoint; the approved age-assurance rule (FR-016) governs whether an account may publish, discover, express interest, or chat.
- End-user authentication is a managed OIDC-as-a-service provider (ADQ-002a, resolved 2026-09-12, ADR-007); the gateway validates the resulting access token on every request. This replaces the current dev-only `x-dev-user-id` header / `DevOidcIssuer` stand-in, which remains in place until that migration happens.
- Services use least-privilege service identities; service-to-service traffic is authenticated and authorized, and moderator/admin routes require separate roles with an audit trail (constitution §7).
- Precise coordinates, government-ID material, payment data, chat content, reports, and trusted-contact details never appear in broad discovery/profile read models or telemetry.
- Public results always use a distance band, never an exact distance (FR-026); the location-disclosure policy governs when a pin/live/moving location becomes visible (FR-002).
- Authentication, publishing, interest, chat, feedback, report, media, and billing endpoints are rate-limited; the full per-endpoint threshold table is approved as v1 policy (`services/api-gateway/src/rate-limit/rate-limit.config.ts`, resolved 2026-09-12). Chat and safety-report/moderation-case retention (12 months, legal-hold override) is also resolved, but not yet implemented — no purge job exists.
- **Browser-specific handling (FR-041)**: the Geolocation and Notification web APIs differ from their native-mobile counterparts — a browser re-prompts for location access more often (typically per session, not once at install) and push delivery is inconsistent across browsers (notably limited/absent on some iOS Safari configurations). The client applies FR-005's last-known-location fallback and FR-006's in-app-live-feed fallback identically on web, so a recipient with denied/unsupported browser permissions still gets the same degraded-but-functional experience already specified for mobile — never a silently broken feature.

## Phase 0/1 Design Outputs

1. `research.md` — technical decisions and outstanding approvals scoped to this feature's plan (Phase 0).
2. `data-model.md` — per-service data ownership, entities, relationships, and state transitions (Phase 1).
3. `contracts/api-standards.md` and `contracts/events.md` — REST and domain-event contract conventions, with one worked example (Phase 1).
4. `quickstart.md` — end-to-end validation guide tied to each user story's independent test (Phase 1).
5. `../docs/architecture/decisions.md` — the durable, cross-feature Architecture Decision Record (ADR-001 through ADR-010), the single consolidated open-decision tracker (ADQ-001 through ADQ-008), and the architecture risk register. This is a living document, not regenerated per feature; later features append to it rather than restating it.
6. This plan's Constitution Check, re-verified after Phase 1 design (see below).

## Post-Design Re-Check

Re-run after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`) is complete: confirm no new cross-service ownership violation, shared-database shortcut, or client-side domain-logic leak was introduced while turning the Key Entities and Critical Flows above into concrete schemas and contracts. Result recorded at the end of `data-model.md`.

## Complexity Tracking

| Violation / Cost | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Nine deployable domain services instead of one | Constitution §5 mandates a layered, domain-aligned microservice architecture serving multiple frontend types with explicit per-service data ownership | A modular monolith would cut early operational cost but does not meet the constitution's mandated architecture, and would blur the ownership boundaries §5 requires for sensitive data (location, identity, payments, moderation) |
| Durable event transport | Offer, discovery, notification, messaging, billing, and moderation state must propagate reliably without tight coupling (constitution §5's outbox/idempotent-consumer rule) | Synchronous chained REST calls between services would couple availability across domains and cannot tolerate a slow/offline downstream service during a 5-30 minute offer window |
| Isolated per-service PostgreSQL ownership | Location, identity, chat, reports, and billing have materially different access, encryption, and retention requirements (constitution §7) | A shared database would let one service's schema change break another's queries and would expose sensitive data more broadly than any single journey requires (constitution §3.IV) |
