# Architecture Decision Record: Stranger Platform

**Status**: Living document — new ADRs are appended here, they are not regenerated per feature. This is the durable architecture decision log referenced by `specs/plan.md` and `specs/research.md` for the `001-stranger-meet-offers` feature; later features append rather than restate.
**Governance**: Per constitution §6, this document and the active Spec Kit specification must never state conflicting requirements — a discrepancy stops implementation until the product owner resolves it. Per constitution §9, no ADR here authorizes production deployment; that always requires separate human approval.

## Adopted Architecture Decisions

### ADR-001 — Frontend-neutral REST platform
**Status**: Accepted (amended 2026-09-10: browser access moved from "supported, unscheduled" to "ships in v1")
**Decision**: Flutter clients for Android/iOS phones and tablets, AND a responsive Flutter Web build for desktop/laptop/Chromebook browsers, use versioned REST APIs (`/api/v1`) through a single API gateway — both ship in v1 with full feature parity (spec.md FR-041, resolved 2026-09-10). Native desktop packaging (an installable Windows/macOS/Linux app, distinct from browser access) remains deferred. No API is tailored to one screen, device class, or platform.
**Rationale**: The product must let a person use Stranger without installing anything, not only serve mobile as the sole entry point (constitution §4's "mobile, tablet, browser, and computer" scope, now committed rather than aspirational for browser).
**Consequences**: Public APIs require OpenAPI contracts, semantic versioning, backward-compatible changes, and contract tests (`specs/contracts/api-standards.md`). Flutter screens adapt presentation to form factor without changing business rules. The client additionally branches on platform (`kIsWeb`) specifically where a browser API differs from its native-mobile counterpart — geolocation permission model and notification delivery — applying the same fallback rules already specified for mobile (FR-005, FR-006) rather than a degraded browser experience.

### ADR-002 — Layered, domain-aligned microservices
**Status**: Accepted
**Decision**: The platform is grouped into client-experience, API/edge, domain-service, and platform/integration layers. The initial bounded contexts are Identity & Profile, Offer, Discovery & Location, Participation, Messaging, Trust & Safety, Entitlements & Billing, Notification, and Media (`specs/plan.md` Solution Architecture).
**Rationale**: These domains have materially different security, retention, scale, and change characteristics, and must be reachable by any approved frontend through explicit contracts (constitution §5).
**Consequences**: The team accepts the operational cost of per-service deployment, service-to-service auth, contract compatibility, and observability. A shared database or a generic catch-all "backend service" is not permitted.

### ADR-003 — Data ownership and event consistency
**Status**: Accepted
**Decision**: Every microservice owns its PostgreSQL data and exposes it only through contracts. Cross-service state propagation uses domain events written through a transactional outbox and consumed idempotently (`specs/contracts/events.md`). Redis is never the canonical source of offer, participation, payment, or audit state.
**Rationale**: Eventual consistency is preferable to unsafe direct table access, especially for identity, precise location, chat, safety reports, and billing (constitution §5, §7).
**Consequences**: The UI must tolerate delayed feed/notification updates and re-check authoritative offer status before an action commits (see `specs/data-model.md`'s `MeetOffer` state machine). A durable event transport (ADQ-001 below) is mandatory before production approval.

### ADR-004 — Localization is a cross-cutting client and API concern
**Status**: Accepted
**Decision**: Default language derives from device locale, with a user override and an English fallback. Static/system copy uses translation keys; server-generated templates use the saved preference. User-created content (activity text, chat, feedback) is stored and shown in its original language only.
**Rationale**: The product must support each user's device language without assuming a user-content translation feature (constitution §5).
**Consequences**: Translation catalogs, locale-aware formatting (dates, currency, distance-band labels), and localization tests are required. Automated translation of user content is a separate, not-yet-approved requirement.

### ADR-005 — Entitlements are a single server-side authority
**Status**: Accepted
**Decision**: Entitlements & Billing is the only service that decides whether an offer may publish under the free allowance, a one-time purchase, or an active subscription. Offer synchronously requests reserve/authorize before persisting an offer as active (`specs/plan.md`'s "Publish an offer" flow; `specs/contracts/public/offer-service.md`).
**Rationale**: Free-allowance limits, the one-time purchase, subscriptions, and store/payment callbacks cannot safely be enforced client-side or duplicated inside Offer (FR-030 through FR-037).
**Consequences**: The service needs idempotent purchase processing, a durable audit ledger, entitlement reservation/release, webhook validation, and reconciliation (`specs/data-model.md`'s `PublishingEntitlementLedger`). Payment-provider decisions (ADQ-004) remain an approval gate.

## Open Decisions Requiring Approval

Reconciled against `specs/research.md` and `specs/spec.md`'s Clarifications — two items below were narrowed from an earlier draft because part of what they asked was already resolved.

| ID | Decision | Status | Options / impact |
| --- | --- | --- | --- |
| ADQ-001 | Durable event transport | Open | Managed broker, NATS JetStream, RabbitMQ, or Kafka (see `research.md` §5's recommendation). Affects deployment, replay, ordering, incident operations. |
| ADQ-002a | Authentication provider/mechanism | Open | Managed vs. self-hosted OIDC (`research.md` §9). Every service depends on this; blocks Identity & Profile's contract. |
| ADQ-002b | Ongoing age-assurance operations | Open | **Narrowed**: the age-assurance *rule* is already decided (self-declared DOB + mandatory liveness check, escalate to gov-ID if flagged, manual appeal — spec Open Question 1, FR-016). Still open: periodic re-verification, post-signup minor detection, enforcement actions, and v1 launch countries. |
| ADQ-003 | Map/location provider strategy | **Resolved, minor follow-up only** | Spec FR-020 + Clarifications already fix this: platform-default SDK (Apple Maps/iOS, Google Maps/Android), no explicit user choice, client-integrated only (`research.md` §7). Only a geocoding/reverse-geocoding provider for city normalization remains an open, low-impact pick. |
| ADQ-004 | Payment/subscription strategy | Open | Platform in-app purchase recommended (`research.md` §10); base prices, tax, currency conversion, refunds, cancellation, and restore-purchase reconciliation remain open (spec Open Questions 19-22). Blocks Entitlements & Billing implementation. |
| ADQ-005 | Media and identity-document storage | Open | Provider, encryption/key management, scan pipeline, retention, access controls, regional residency (`research.md` §6). Blocks Media service and photo/ID verification design. |
| ADQ-006 | Moderation and trust operating model | Partially resolved | Spec Clarifications already fix: block routed to moderation review with immediate own-view update (FR-015); automated-only content screening applies to every offer including high-risk categories, confirmed via `/speckit-clarify` 2026-09-10 round 5 (FR-039). Still open: review turnaround time, rating scale, feedback consent-capture flow, and appeal rules for a falsely blocked offer. |
| ADQ-007 | Launch SLOs and capacity | Open | Initial countries/cities, peak concurrent users, p95 targets beyond the one supplied (FR-006's ~30s push target), recovery objectives (`research.md` §12, `plan.md` Scale/Scope). Controls infrastructure sizing and cost. |
| ADQ-008 | Supported-browser matrix and web accessibility standard | Open | Which browsers/versions (e.g., current Chrome, Safari, Firefox, Edge) are officially supported for the v1 Flutter Web build, and which accessibility standard (e.g., WCAG level) applies (spec.md FR-041, Open Question 24, added 2026-09-10 when browser access moved into v1 scope). Controls Flutter Web QA/CI matrix scope. |

## Architecture Risks and Mitigations

| Risk | Consequence | Required mitigation |
| --- | --- | --- |
| Microservice operational complexity | Slow, fragile early delivery | Monorepo, shared contract standards (`specs/contracts/api-standards.md`), Docker local environment, CI contract tests, observability from the first service. |
| Cross-service timing around offer expiry and selection | A user sees an expired offer or a duplicate chat | Offer is authoritative on status; server time is authoritative; idempotency keys and idempotent event consumers protect retries (`specs/contracts/events.md`). |
| Location/privacy leakage | User safety and legal risk | Distance bands, privacy-focused read models, least privilege, explicit disclosure staging, retention policy (constitution §3.IV, `specs/data-model.md`). |
| Payment entitlement race/replay | Free-limit bypass or lost purchases | Server-side purchase verification, idempotent webhooks, audit ledger, atomic authorization/reservation (ADR-005). |
| Public ratings/photos abuse | Harassment, false reputation damage, privacy harm | Consent, moderation, reporting/removal/appeal policy, visibility states, anti-retaliation design (constitution §3.V). |
| Unbounded city interests / large discovery feeds | Slow ranking and high cost | Indexing/pagination strategy, cacheable read-model projections, rate limits, launch-capacity targets (ADQ-007). |
| Browser geolocation/push are less reliable than native mobile | A web user could silently miss the FR-006 ~30s delivery target or get stale location-based ranking | Apply the same permission-denied/fallback rules already specified for mobile (FR-005 last-known-location, FR-006 in-app-live-feed fallback) identically on web; never let a browser limitation degrade into an unexplained broken feature (ADR-001, ADQ-008). |

## Approval Outcome

This document guides clarification and contract design now. It does not authorize `/speckit-tasks` execution or production deployment for any capability that depends on an "Open" row above — approve each ADQ individually (owner + target date) before the dependent implementation task is unblocked, per `specs/plan.md`'s Constitution Check and constitution §9.
