# Domain Event Contracts: Ephemeral Stranger Meet Offers

Transport: self-hosted Kafka (resolved 2026-09-12 via `/speckit-clarify`, ADQ-001, `research.md` §5, `docs/architecture/decisions.md` ADR-008 — the current implementation still targets a dev-only Redis-based pub/sub substitute pending migration), transactional outbox at the publisher, idempotent consumers at every subscriber (constitution §5). Every event shares this envelope:

```json
{
  "eventId": "uuid",
  "eventType": "offer.published",
  "aggregateId": "offer-uuid",
  "aggregateVersion": 1,
  "occurredAt": "2026-09-10T12:00:00Z",
  "correlationId": "uuid",
  "causationId": "uuid-or-null",
  "producedBy": "offer-service",
  "schemaVersion": 1,
  "data": { }
}
```

- `aggregateId` + `aggregateVersion` let a consumer detect an out-of-order or already-applied event without relying on delivery order from the bus.
- `correlationId` ties an event back to the originating client request across every service it touches (matches the request id in `api-standards.md`'s logging rule); `causationId` names the specific prior event (if any) that produced this one, for incident/audit tracing.
- Consumers dedupe on `eventId`; a redelivery with the same `eventId` MUST be a no-op the second time (constitution §5's idempotent-consumer rule).

## Payload Minimization Rule

An event payload carries only the fields its *actual* consumers need — never "everything about the aggregate" by default. A field classified Highly Restricted or Restricted (see `data-model.md`'s Sensitive-Data Classification) never appears in an event payload unless a named consumer has a documented need, and even then only to that consumer's own internal contract, never to a broadly-fanned-out public event. Concretely for this feature: `offer.published` fans out to Notification (which needs no location precision at all) as well as Discovery & Location, so it MUST NOT carry the offer's precise coordinates — see `offer.published` below for the corrected shape.

## offer.published
- Producer: Offer
- Consumers: Discovery & Location (build eligibility read model), Notification (create delivery jobs)
- `data`: `{ offerId, creatorUserId, cityId, placeGeohash, placeKind: "pin" | "venue" | "live" | "moving", activityText, lifetimeMinutes, capacity, publishedAt, expiresAt }`
- `placeGeohash` is a **truncated** geohash (precision fixed at a neighborhood-scale length, e.g. 6 characters ≈ ~1.2 km × 0.6 km cell — exact length confirmed in `data-model.md`'s Discovery & Location section) — enough for Discovery & Location's radius bucketing, never enough to identify the exact meeting point. Discovery & Location does not receive, store, or compute with the offer's exact `lat`/`lng` at all.
- The offer's exact coordinates stay solely in Offer's own database. Any service that genuinely needs the precise point (Participation, only after a selection, to render the post-selection reveal per FR-002) fetches it via a synchronous, authenticated internal call — `GET /internal/v1/offers/{offerId}/place` — scoped to that one selection, never cached beyond the request, and never republished onto the event bus.

## offer.stopped / offer.expired
- Producer: Offer
- Consumers: Discovery & Location (remove from active read model), Participation (reject new interest), Notification (send outcome messages, incl. "expired without selection" per FR-027)
- `data`: `{ offerId, endedAt, reason: "stopped" | "expired" }`

## participation.interest-expressed
- Producer: Participation
- Consumers: Notification (alert creator); Offer and Discovery & Location (each maintain their own denormalized `interestCount` for their respective offer-detail and feed responses — FR-042, resolved via `/speckit-clarify`)
- `data`: `{ offerId, expressionOfInterestId, recipientUserId, hasMessage: boolean }` — the message body itself is not broadcast on the event; the creator's client fetches it via the authenticated REST contract, keeping free-text content out of the event log. `recipientUserId` is present for the creator-alert use case but Offer/Discovery consumers only ever use the event as a `+1` signal — they never expose `recipientUserId` in a public response, keeping the public count non-identifying per FR-042.

## participation.participant-selected
- Producer: Participation
- Consumers: Messaging (create the one shared group chat per FR-009), Notification (inform creator + all selected recipients)
- `data`: `{ offerId, selectionId, expressionOfInterestId, recipientUserId, selectedAt }`
- Idempotency note: Messaging must treat a redelivery for a `selectionId` it has already handled as a no-op — it must never create a second chat or add a duplicate membership row.

## participation.selection-resolved
- Producer: Participation
- Consumers: Trust & Safety (create the `RatingFeedback` eligibility record), Messaging (archive chat to read-only if `outcome == cancelled`), Notification (notify the other party per FR-038)
- `data`: `{ offerId, selectionId, outcome: "happened" | "cancelled", cancelledBy: "creator" | "recipient" | null, resolvedAt }`

## billing.subscription-changed
- Producer: Entitlements & Billing
- Consumers: Notification (confirm state change to the user)
- `data`: `{ userId, subscriptionId, plan, status, currentPeriodEnd }`

## billing.one-time-broadcast-granted
- Producer: Entitlements & Billing
- Consumers: Notification
- `data`: `{ userId, purchaseId, priceMinor, currency, purchasedAt }`

## trust.rating-submitted
- Producer: Trust & Safety
- Consumers: Identity & Profile (refresh the public trust-signal summary shown on a profile)
- `data`: `{ ratingFeedbackId, offerId, rateeUserId, starRating, visibility }` — fires only on a visibility transition (e.g., to `public`), not on initial (pre-moderation) submission. Never carries `writtenFeedback` text or a photo reference — Identity & Profile links to the rating, it does not mirror its content.

## trust.moderation-decisioned
- Producer: Trust & Safety
- Consumers: Identity & Profile (enforcement action if applicable), Offer (unpublish if a screening decision is reversed post-publish)
- `data`: `{ caseId, subjectType, subjectId, decision: "enforced" | "rejected" | "appeal_upheld" | "appeal_denied", decidedAt }` — carries only an opaque case id and routing metadata; report/evidence content never leaves Trust & Safety (constitution §3.V).

## identity.user-eligibility-changed
- Producer: Identity & Profile
- Consumers: Offer (block/allow future publishes), Participation (block/allow future expressions of interest), Messaging (block/allow future messages)
- `data`: `{ userId, ageAssuranceStatus, effectiveAt }` — carries only the enforcement-relevant status enum, never the underlying evidence (self-declared DOB, liveness result, ID document).

## Naming & Schema Evolution Rules
- Event type names are dot-namespaced, lowercase, `<owning-domain>.<past-tense-fact>` (`offer.published`, not `OfferPublished`) — this also matches common broker topic-naming conventions (`research.md` §5) so a topic-per-event-type routing scheme needs no translation layer.
- `schemaVersion` increments on any breaking change to `data`; a consumer declares which version(s) it understands and a producer keeps emitting the previous version until every consumer has migrated — mirrors the REST versioning rule in `api-standards.md` so events and endpoints never drift onto different compatibility philosophies.
