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

### ADR-006 — Supported-browser matrix and web accessibility standard
**Status**: Accepted 2026-09-12 (ADQ-008 approved as drafted, via `/speckit-clarify`; see `specs/spec.md` Clarifications, Session 2026-09-12). Only Chrome has actually been exercised against the running app so far (manually, in this environment); Safari/Firefox/Edge are the approved targets named in `specs/tasks.md` T121, not yet verified.
**Decision**: Support the latest stable release of Chrome, Safari, Firefox, and Edge at time of v1 launch, re-evaluated each release per platform's normal update cadence (no fixed version pinning, since Flutter Web's own support policy tracks current browser versions). WCAG 2.1 Level AA is the applicable accessibility standard, consistent with `plan.md`'s "mobile, tablet, browser, and computer" scope commitment (constitution §4) treating browser access as a first-class surface, not a degraded fallback.
**Rationale**: A fixed matrix (current stable × 4 major engines) is standard practice for a Flutter Web app with no legacy-browser requirement stated anywhere in `spec.md`; WCAG 2.1 AA is the common baseline most jurisdictions' accessibility regulations reference, and nothing in this feature's requirements calls for a higher (AAA) or lower (A-only) bar.
**Consequences**: `apps/stranger_flutter/test/web_e2e/` (T119) should run against this same matrix; a semantic/contrast audit against WCAG 2.1 AA becomes a release gate, not optional polish; any Flutter widget lacking a `Semantics` label or failing contrast becomes a tracked defect, not a style nit.
**Not yet done**: automated cross-browser testing beyond Chrome, a real accessibility audit (only informal use so far — no `flutter_a11y`/axe-style scan run), and Safari/Firefox/Edge manual verification (only Chrome has been driven in this environment).

### ADR-007 — Managed OIDC-as-a-service authentication
**Status**: Accepted 2026-09-12 (ADQ-002a resolved via `/speckit-clarify`; see `specs/spec.md` Clarifications, Session 2026-09-12).
**Decision**: Replace the dev-only `x-dev-user-id` header / `DevOidcIssuer` stand-in with a managed OIDC-as-a-service provider (e.g. Auth0, Clerk, or AWS Cognito — specific vendor still open) for both the Flutter mobile and web clients.
**Rationale**: The app handles age-verification and identity-document data; a managed provider's free tier covers test/beta volume at $0 while the vendor — not this team — owns session security, MFA, and social-login correctness, which is a better place for that risk to sit than a self-hosted or custom-built issuer at this team's current size.
**Consequences**: `services/api-gateway/src/auth/dev-oidc-issuer.ts` and every service's `devPrincipalMiddleware` become migration targets, not launch-ready code. API Gateway's token validation must switch from the dev issuer's keys to the chosen provider's JWKS endpoint. Vendor selection, tenant setup, and the mobile/web SDK integration remain open follow-up work.

### ADR-008 — Self-hosted Kafka as the durable event transport
**Status**: Accepted 2026-09-12 (ADQ-001 resolved via `/speckit-clarify`; see `specs/spec.md` Clarifications, Session 2026-09-12). Implemented 2026-09-12 (Convergence T123).
**Decision**: Replace the local Redis-based pub/sub substitute (`packages/ts-platform/src/events/`) with a self-hosted Kafka cluster for all domain events (`specs/contracts/events.md`).
**Rationale**: Kafka gives the strongest ordering/replay guarantees of the options considered (`research.md` §5), and running it on the same self-hosted infrastructure already used for the rest of the stack avoids a recurring per-message managed-broker bill, consistent with this project's cost posture.
**Consequences**: ADR-003's "durable event transport... mandatory before production approval" gate is now satisfied, not just satisfiable. The team operates a single-node Kafka cluster in KRaft mode locally (`.tooling/kafka/`, wired into `scripts/startStop/start.sh`/`stop.sh`); production broker sizing, topic/partition design beyond the current one-partition-per-topic default, and multi-broker replication remain follow-up operational work, not an open architecture decision. Every service's outbox-relay and event-consumer code now goes through `KafkaEventBus` via the shared `createEventBus` factory (`EVENT_BUS_DRIVER=kafka`); consumer idempotency (already required by ADR-003) carried over unchanged and needed no rework.

### ADR-009 — Stripe as the payment processor for mobile and web
**Status**: Accepted 2026-09-12 (ADQ-004 resolved via `/speckit-clarify`; see `specs/spec.md` Clarifications, Session 2026-09-12).
**Decision**: Entitlements & Billing uses Stripe, identically on mobile and web, for the one-time broadcast purchase and the weekly/monthly/yearly subscriptions — replacing the prior platform-in-app-purchase recommendation.
**Rationale**: The browser-parity decision (ADR-001 amendment) means purchases must work in a desktop browser tab, where Apple/Google in-app purchase has no equivalent. A single processor avoids maintaining separate IAP and web purchase/receipt-verification code paths, and Stripe has built-in subscription, proration, and webhook support the service's existing webhook-verification structure can build on directly.
**Consequences**: `services/entitlements-billing/src/payment-webhook/mock-payment-verifier.ts` (built against an Apple/Google receipt-verification assumption) is a migration target, not launch-ready code. Base prices, tax handling, trials/promotions, currency conversion, and launch-region rules (spec.md Open Questions 20-22) remain open follow-up work, now scoped against a single processor instead of two.

### ADR-010 — Managed cloud object storage for media and identity documents
**Status**: Accepted 2026-09-12 (ADQ-005 resolved via `/speckit-clarify`; see `specs/spec.md` Clarifications, Session 2026-09-12).
**Decision**: The Media service's `StorageAdapter` implementation becomes a managed cloud object store (AWS S3, GCS, or Azure Blob — specific vendor still open) behind the existing interface, replacing `LocalFilesystemStorageAdapter` for profile photos, feedback photos, and government-ID verification documents.
**Rationale**: Unlike compute, object storage is priced per GB and is near-zero cost at test-phase volume, so the project's usual cost-avoidance rationale for self-hosting doesn't apply here — while a managed provider gives encryption-at-rest, access logging, and compliance posture "for free" that self-hosting the platform's most sensitive data category (government ID images) would otherwise require building and auditing in-house.
**Consequences**: `services/media/src/storage/local-filesystem-storage.adapter.ts` is a migration target, not launch-ready code, but the swap is contained to one class behind `StorageAdapter` (no other service or Media endpoint depends on it directly). Vendor selection, encryption/key management, retention policy, access controls, and regional-residency requirements (`research.md` §6) remain open follow-up work.

## Open Decisions Requiring Approval

Reconciled against `specs/research.md` and `specs/spec.md`'s Clarifications. Five items below (ADQ-001, ADQ-002a, ADQ-004, ADQ-005, ADQ-008) were resolved 2026-09-12 via `/speckit-clarify` — see ADR-007 through ADR-010 and ADR-006 above for the accepted decisions and their consequences.

| ID | Decision | Status | Options / impact |
| --- | --- | --- | --- |
| ADQ-001 | Durable event transport | **Resolved** | Self-hosted Kafka (ADR-008). Vendor/managed-broker alternatives no longer under consideration. |
| ADQ-002a | Authentication provider/mechanism | **Resolved, vendor still open** | Managed OIDC-as-a-service (ADR-007). Specific vendor (Auth0 vs. Clerk vs. Cognito) remains an open, low-impact pick. |
| ADQ-002b | Ongoing age-assurance operations | Open | The age-assurance *rule* is already decided (self-declared DOB + mandatory liveness check, escalate to gov-ID if flagged, manual appeal — spec Open Question 1, FR-016). Still open: periodic re-verification, post-signup minor detection, enforcement actions, and v1 launch countries. Deferred from the 2026-09-12 round — needs legal/compliance input, not just an engineering pick. |
| ADQ-003 | Map/location provider strategy | **Resolved, minor follow-up only** | Spec FR-020 + Clarifications already fix this: platform-default SDK (Apple Maps/iOS, Google Maps/Android), no explicit user choice, client-integrated only (`research.md` §7). Only a geocoding/reverse-geocoding provider for city normalization remains an open, low-impact pick. |
| ADQ-004 | Payment/subscription strategy | **Resolved, pricing details still open** | Stripe, identically on mobile and web (ADR-009). Base prices, tax, currency conversion, refunds, cancellation, and restore-purchase reconciliation remain open (spec Open Questions 20-22). |
| ADQ-005 | Media and identity-document storage | **Resolved, vendor still open** | Managed cloud object storage (ADR-010). Specific vendor (S3 vs. GCS vs. Azure Blob), encryption/key management, scan pipeline, retention, access controls, and regional residency (`research.md` §6) remain open follow-up work. |
| ADQ-006 | Moderation and trust operating model | **Resolved** | Spec Clarifications already fix: block routed to moderation review with immediate own-view update (FR-015); automated-only content screening applies to every offer (FR-039). Review turnaround (4-hour SLA), rating scale (1-5 stars), and the feedback photo-consent-capture flow are *already implemented* (`moderation.service.ts`, `rating/dto.ts`, `POST /ratings/:id/photo-consent`) — this table previously listed them as open by mistake, corrected 2026-09-12. Also resolved 2026-09-12 via `/speckit-clarify` (spec.md Clarifications, Session 2026-09-12 round 2), **not yet implemented**: rating visibility (mutual → immediate public; one-sided → public after a 5-day SLA); a self-service appeal path for a falsely-screened-and-rejected offer, mirroring the existing age-verification appeal flow (today's `internal/v1/trust-safety/screening-overrides` is moderator-initiated only). |
| ADQ-007 | Launch SLOs and capacity | Open | Initial countries/cities, peak concurrent users, p95 targets beyond the one supplied (FR-006's ~30s push target), recovery objectives (`research.md` §12, `plan.md` Scale/Scope). Controls infrastructure sizing and cost. Deferred from the 2026-09-12 round — needs real traffic/business forecasts, not a short clarification answer. |
| ADQ-008 | Supported-browser matrix and web accessibility standard | **Resolved** | Current-stable Chrome, Safari, Firefox, Edge; WCAG 2.1 AA (ADR-006, approved as drafted). Cross-browser testing beyond Chrome and a formal accessibility audit are now tracked engineering work, not open decisions. |

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
