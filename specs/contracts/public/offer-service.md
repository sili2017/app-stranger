# Public Contract: Offer Service (worked example)

Base path: `/api/v1/offers`. Conventions: see `../api-standards.md`.

## POST /api/v1/offers — Publish an offer

Auth: bearer token required; caller must have `ageAssuranceStatus` in an allowed-to-publish state (`liveness_passed` or `id_verified` — see `data-model.md`).

Headers: `Idempotency-Key` required.

Request:
```json
{
  "activityText": "Sunny wants to drink tea",
  "place": { "kind": "pin", "lat": 18.9398, "lng": 72.8355 },
  "lifetimeMinutes": 15,
  "capacity": 3,
  "moneyPreference": { "label": "split", "note": "roughly 200 INR each" }
}
```
- `lifetimeMinutes`: optional, integer 5-30, default 15 (FR-003).
- `capacity`: required, integer 1-10 (FR-008); immutable once published.
- `place.kind`: `pin | venue | live | moving`; `lat`/`lng` required for all kinds per the single-snapshot rule (Clarifications). `rendezvousInstruction` (short free text) is **required** when `kind == "moving"` or the location is a queue-style spot without a fixed venue (FR-002), optional otherwise — validated server-side, not just suggested client-side.
- `moneyPreference`: optional; `label` is one of `creator_pays | byo | split | estimated_cost`; `note` is free text, moderated post-publish (FR-028), max length `NEEDS CLARIFICATION`.

Server-side sequence (see `plan.md` Critical Cross-Service Flows):
1. Gateway authenticates, forwards verified principal.
2. Offer runs FR-039 automated screening synchronously; on failure, returns `422 CONTENT_SCREENING_FAILED` and never calls Entitlements & Billing.
3. Offer calls Entitlements & Billing's internal `POST /internal/v1/entitlements/authorize` (reserve-or-reject); on rejection, returns `402 ENTITLEMENT_REQUIRED` with the caller's current allowance/subscription options in the response body so the client can offer the purchase/subscription flow (FR-031, FR-034).
4. On success, Offer persists the `active` `MeetOffer` and its `offer.published` outbox event (geohash only — never exact coordinates, per `contracts/events.md`) in the same transaction.

Response `201 Created`:
```json
{
  "id": "offer-uuid",
  "status": "active",
  "publishedAt": "2026-09-10T12:00:00Z",
  "expiresAt": "2026-09-10T12:15:00Z",
  "capacity": 3,
  "interestCount": 0,
  "remainingFreeAllowanceThisMonth": 1
}
```
`interestCount` is a live, non-identifying total shown to any viewer while `status == active` (FR-042); `GET /api/v1/offers/{offerId}` returns the same field, updated as `participation.interest-expressed` events arrive.

Errors: `401` unauthenticated, `403 ACCOUNT_RESTRICTED` (age-assurance not passed), `422 CONTENT_SCREENING_FAILED`, `402 ENTITLEMENT_REQUIRED`, `429` rate-limited.

Rate limit: per constitution §5's abuse-prevention rule — publishing is limited to 5 per user per 60 seconds (`services/api-gateway/src/rate-limit/rate-limit.config.ts`), approved as v1 launch policy 2026-09-12 via `/speckit-clarify` (resolved — no longer NEEDS CLARIFICATION).

## POST /api/v1/offers/{offerId}/expressions-of-interest — Express interest

Auth: bearer token; caller must be an eligible recipient per Discovery & Location's `DiscoveryEligibility` read model (not re-derived here — Participation calls Discovery & Location's internal contract to confirm eligibility at write time, not just at read time, to close the race edge case where an offer expires mid-submission).

Request: `{ "message": "sounds fun, on my way!" }` (optional, FR-025)

Responses: `201 Created` with the `ExpressionOfInterest`; `409 OFFER_NOT_ACTIVE` if the offer expired/stopped since the client last read it (FR-010) — this is the authoritative resolution of the "offer expires while a recipient is submitting" edge case named in `spec.md`'s Edge Cases.

## POST /api/v1/offers/{offerId}/selections — Creator selects a recipient

Auth: bearer token; caller must be `MeetOffer.creatorUserId`.

Request: `{ "expressionOfInterestId": "eoi-uuid" }`

Responses: `201 Created` with the `Selection` (triggers `participation.participant-selected`); `409 CAPACITY_REACHED` if `capacity` is already filled; `409 OFFER_NOT_ACTIVE`. Selecting the same `expressionOfInterestId` twice (retried request) is idempotent via `Idempotency-Key`, not by re-selection logic.

This single worked contract sets the pattern (auth → domain validation → cross-service authorization/event → standard error codes) that every other endpoint in `contracts/public/` and `contracts/internal/` follows; the remaining endpoints are enumerated, not fully specified, in Phase 2 (`/speckit-tasks`) once the still-open product decisions in `research.md`'s approval table are resolved.
