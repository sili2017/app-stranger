# API Contract Standards: Ephemeral Stranger Meet Offers

Applies to every endpoint the API Gateway exposes to Flutter clients, and to every inter-service REST call. Satisfies constitution §7's requirement that "every public API endpoint must specify request/response schemas, authentication, authorization, validation, standard errors, rate limits, and logging/audit requirements."

## Versioning
- Public contracts are URI-versioned: `/api/v1/...`. A breaking change ships as `/api/v2/...` alongside `v1` until clients migrate; it is never a silent in-place change.
- Inter-service contracts (gateway → domain service, or domain service → domain service) version the same way under `/internal/v1/...` and are documented in `contracts/internal/` (per `plan.md`'s Project Structure), even though no external client ever calls them directly.

## Authentication & Authorization
- Every request (except unauthenticated signup/login) carries an OAuth2/OIDC bearer access token (see `research.md` §9), validated once at the gateway.
- The gateway forwards a verified, signed internal principal (user id + adult-eligibility status) to domain services; a domain service never re-validates the raw client token, but always re-checks *authorization* for the specific resource (e.g., "is this caller the offer's creator?") itself — the gateway only proves *who*, never *may they*.
- Moderator/admin routes require a distinct role claim and are logged to the audit trail described below (constitution §7).

## Initial Public Resource Boundary

Contract-planning boundaries, not an approval of every listed operation — authentication, actor roles, field visibility, exact errors, and rate limits are still specified per endpoint (see `contracts/public/offer-service.md` for the worked pattern).

| Public resource group | Owning service | Illustrative operations |
| --- | --- | --- |
| `/me`, `/profiles`, `/verification`, `/city-interests` | Identity & Profile | current user, visible profile, preferences, verification status, city interests |
| `/offers`, `/offers/{id}`, `/offers/{id}/rebroadcast` | Offer | create, view, stop, lifecycle/history, rebroadcast |
| `/discovery/feed` | Discovery & Location | nearby/city feeds, filters (activity, distance band, time remaining — FR-022), distance bands |
| `/offers/{id}/expressions-of-interest`, `/offers/{id}/selections` | Participation | express interest with message, list creator-visible interests, select participant |
| `/conversations`, `/conversations/{id}/messages` | Messaging | list authorized conversations, send/read messages |
| `/reports`, `/blocks`, `/ratings`, `/trusted-contacts` | Trust & Safety | report/block, submit/view approved feedback, trusted-contact controls |
| `/entitlements`, `/subscriptions`, `/broadcast-purchases` | Entitlements & Billing | allowance, local pricing, checkout handoff, subscription state, restore/cancel intent |
| `/notifications`, `/media` | Notification / Media | notification preferences/history; approved media upload/access workflow |

## Standard Request/Response Shape
- JSON bodies only. Every resource has a stable `id` (uuid).
- Timestamps: ISO-8601 UTC.
- Money: integer minor units + ISO 4217 currency code (`{ amountMinor: 100, currency: "USD" }`), never a float.
- Pagination (feeds, history): cursor-based — `?cursor=&limit=` request, `{ items: [...], nextCursor: string | null }` response.

## Standard Error Format
```json
{
  "error": {
    "code": "OFFER_NOT_ACTIVE",
    "messageKey": "offers.notActive",
    "correlationId": "...",
    "details": []
  }
}
```
- `code` is a stable, machine-readable enum documented per endpoint — clients branch on `code`, never on any text.
- `messageKey` is a translation key, not a hardcoded English string — the client resolves it to the user's language client-side, consistent with ADR-004's rule that all system-generated text goes through translation keys (`docs/architecture/decisions.md`). A server never returns a pre-rendered English `message` field for a client to display as-is.
- `details` carries structured, field-level validation info (e.g., `[{ "field": "capacity", "issue": "OUT_OF_RANGE" }]`) when `code` is a validation error; empty otherwise.
- HTTP status follows standard semantics (400 validation, 401 unauthenticated, 403 unauthorized, 404 not found, 409 conflict e.g. `OFFER_NOT_ACTIVE`/`CAPACITY_REACHED`, 429 rate-limited, 5xx server).
- The gateway reads `Accept-Language` on every request; it informs which localized template Notification uses for out-of-band messages, but never changes an error response body itself — that stays `messageKey`-only per the rule above.

## Rate Limits
- Enforced at the gateway per constitution §5's security rules; every endpoint listed in `plan.md`'s Security and Privacy Architecture (auth, publish, interest, chat, feedback, report, media, billing) declares an explicit limit in its own contract file. No endpoint ships without a stated limit — a limit of "none" must be an explicit, reviewed exception, not an omission.

## Idempotency
- Every state-changing endpoint that a redelivered event or a client retry could duplicate (publish offer, express interest, select participant, confirm purchase) accepts an `Idempotency-Key` header; a repeated key with the same body returns the original result rather than creating a second resource.
- Domain-event consumers apply the same principle via the event's own `eventId` (see `events.md`).

## Logging & Audit
- Every request/response is logged with a correlation/request id, caller id, route, status, and latency — never with chat content, verification documents, payment identifiers, or precise coordinates (constitution §5, §7).
- Moderator/admin actions (block/report resolution, content-screening override, verification appeal decision) write a separate, immutable audit-event stream distinct from ordinary application logs.

## Internal Service Contract Rules

Applies to every service-to-service REST call under `/internal/v1/...` (e.g., Offer → Entitlements & Billing's authorize call, Participation → Discovery & Location's eligibility revalidation, Participation → Offer's scoped place lookup).

- Calls carry an authenticated service identity (constitution §7), not a forwarded user token — the caller re-derives what it's allowed to ask for from its own service credentials.
- A resource-owning service always re-checks authorization itself; the gateway having already authenticated the originating client request is never treated as sufficient authorization for the internal call downstream.
- Timeouts are mandatory on every call; retries are permitted only when the target operation is documented idempotent (matches the `Idempotency-Key` rule above).
- A slow or failing internal dependency degrades via circuit breaking rather than cascading — e.g., Discovery & Location's eligibility revalidation failing should reject the specific write with a `503`/retry-later response, not take down Participation.
- Every internal contract is consumer-driven contract-tested (`research.md` §11); a consumer depends only on the documented contract, never on the provider's internal database shape.
- The correlation id from the originating client request (or `correlationId` from the triggering event, per `contracts/events.md`) propagates through every internal call for end-to-end tracing.

## Contract Testing
- Every file under `contracts/public/` and `contracts/internal/` is validated by an automated schema-conformance test (per `research.md` §11) in CI before merge — a contract change without a passing conformance test against its own service is rejected.
