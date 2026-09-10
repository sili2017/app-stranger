# Phase 1 Data Model: Ephemeral Stranger Meet Offers

**Input**: `spec.md` Key Entities, `plan.md` Solution Architecture, `research.md`.
**Convention**: Each entity is owned by exactly one service's PostgreSQL database (constitution §4-5, §7). A field named `<x>Id` that refers to another service's entity is a reference by ID only, kept consistent via the domain events in `contracts/events.md` — never a foreign key across databases.

## Identity & Profile service

Split into four sub-entities (refined from an earlier single flat `User` entity) so that auth/eligibility, public display, billing-relevant address, and the verification workflow — each with different sensitivity and change cadence — aren't forced into one row. All four are still owned exclusively by Identity & Profile; this is an internal refinement, not a new cross-service boundary.

### UserAccount
- `id` (uuid, pk)
- `authSubject` (opaque subject id from the OIDC provider, `research.md` §9)
- `dateOfBirth` — self-declared at signup (FR-016); Highly Restricted, never shown publicly, never in an event payload
- `ageAssuranceStatus`: `self_declared` → `liveness_passed` | `liveness_flagged_pending_id` → `id_verified` | `id_rejected_appeal_pending` | `restricted` (FR-016, Open Question 1). A user in `liveness_flagged_pending_id`, `id_rejected_appeal_pending`, or `restricted` cannot publish an offer, express interest, or chat (enforced by each owning service via a synchronous check against Identity & Profile / the cached `identity.user-eligibility-changed` status, not duplicated business logic).
- `accountStatus`: `active | disabled`
- `createdAt`, `updatedAt`

### PublicProfile
- `id` (uuid, pk = `UserAccount.id`)
- `firstName`, `photoAssetId` (→ Media) — public per FR-013
- `ageRangeLabel` (derived, never the exact `dateOfBirth` — e.g. "25-30")
- `interests` (string[], profile display, distinct from City Interest below)
- `verificationStatus`: `unverified` | `photo_verified` | `id_verified` — the *optional* profile-trust verification distinct from `ageAssuranceStatus` (FR-014). The badge is simply absent while `unverified`; a user cannot hide/suppress its absence.
- `languagePreference` (FR-040)
- `publicRatingSummary` (denormalized, refreshed on `trust.rating-submitted` — average + count only, never individual feedback text)

### RegisteredAddress
- `userId` (pk, fk → UserAccount)
- `city` (normalized city id — see City reference note below)
- `country`
- `calendarTimezone` — the authoritative time-zone mapping used by Entitlements & Billing's calendar-month rule (FR-030); mapping source is **NEEDS CLARIFICATION** (spec Open Question 18)
- `updatedAt` — an address change's effective timing for the in-progress calendar month is **NEEDS CLARIFICATION** (same Open Question)

### VerificationCase
- `id`, `userId`, `kind`: `photo_liveness | government_id`
- `status`: `submitted | passed | flagged | rejected | appeal_pending | appeal_upheld | appeal_denied`
- `evidenceAssetId` (→ Media; the document/photo file itself is never stored here, only referenced)
- `decidedAt`, `decidedBy` (vendor or reviewer reference), audit trail fields
- One `VerificationCase(kind: photo_liveness)` row is the mandatory signup-time check driving `UserAccount.ageAssuranceStatus`; additional rows track the *optional* profile-trust verification reflected in `PublicProfile.verificationStatus` (FR-014 is distinct from FR-016, per spec's Key Entities note).

### City Interest
- `id` (uuid, pk)
- `userId` (fk → UserAccount)
- `cityId` (normalized city reference — **NEEDS CLARIFICATION**: no city-normalization source is chosen yet, spec Assumptions)
- `createdAt`

*A user may have any number of City Interest rows (FR-023).*

## Offer service

### MeetOffer
- `id` (uuid, pk)
- `creatorUserId` (reference to Identity & Profile's User)
- `activityText` (free text; FR-018, FR-021 — optional suggestion chips are a client-only affordance, not stored separately)
- `place`: `{ kind: "pin" | "venue" | "live" | "moving", label?, lat, lng, geohash, rendezvousInstruction?, capturedAt }` — a **single immutable snapshot taken at publish time** (Clarifications: no further updates even for a moving place). `lat`/`lng` are Highly Restricted (see Sensitive-Data Classification below) and never leave Offer's own database except via the scoped internal call described in `contracts/events.md`; `geohash` is the truncated, Operational-classified derivative published on `offer.published` for Discovery & Location's eligibility bucketing. `rendezvousInstruction` (short free text, e.g., "3rd coach from the engine, blue jacket") is **required** when `kind == "moving"` or when a `pin`/`venue` represents a queue-style location without a fixed venue, and optional otherwise (resolved via `/speckit-clarify`, spec.md FR-002); like the rest of `place`, it is disclosed only after selection.
- `cityId` (derived from `place` at publish time; used by Discovery & Location for eligibility)
- `moneyPreference`: `{ label: "creator_pays" | "byo" | "split" | "estimated_cost", note?, noteModerationStatus }` (FR-028)
- `lifetimeMinutes` (int, 5-30, default 15 — FR-003)
- `capacity` (int, 1-10, fixed at publish, immutable while active — FR-008)
- `status`: `active` → `expired` | `stopped` (FR-017); terminal once left `active`
- `publishedAt` (countdown starts here — FR-003), `expiresAt` (`publishedAt + lifetimeMinutes`)
- `rebroadcastOfCityOfferId` (self-reference, nullable — set when created via rebroadcast; exact reuse rule is **NEEDS CLARIFICATION**, spec Open Question re: FR-012)
- `screeningResult`: `{ passed: boolean, ruleVersion, evaluatedAt }` — automated-only screening outcome (FR-039, confirmed v1 scope via Clarifications 2026-09-10 round 5)
- `interestCount` (int, default 0) — denormalized, non-identifying count maintained by consuming `participation.interest-expressed` (never decremented; FR-042, resolved via `/speckit-clarify`). Returned on the public offer-detail response while `status == active`; not itself retained beyond what FR-012's offer history keeps once inactive.

**State transitions**: `active → expired` (server-side timer at `expiresAt`) or `active → stopped` (creator action, FR-011). No other transition exists; a `stopped`/`expired` offer never returns to `active` (a rebroadcast always creates a new `MeetOffer` row).

## Discovery & Location service

### LocationSnapshot (per user, ephemeral/rolling)
- `userId`
- `lat`, `lng`, `source`: `live_gps` | `last_known` (FR-005) — `live_gps` covers both native device GPS (mobile) and the browser Geolocation API (web, FR-041); the field records freshness, not client platform, since both platforms follow the identical last-known-location fallback rule when a live reading isn't available (permission denied, or — on web — no permission granted yet this session)
- `capturedAt`
- Retention/staleness threshold: **NEEDS CLARIFICATION** (spec Open Question 4). Modeled as a Redis-backed rolling value with a periodic durable checkpoint, not full history, pending that answer.

### DiscoveryEligibility (read model, derived — not authoritative)
- Built from `MeetOffer` (via `offer.published`/`offer.stopped`/`offer.expired` events) joined against `City Interest` and `LocationSnapshot`
- Discovery & Location never receives or stores the offer's exact `lat`/`lng` — it holds only `placeGeohash` from the event, per `contracts/events.md`'s Payload Minimization Rule. Distance-band computation for the read model buckets on the geohash cell plus the recipient's own precise `LocationSnapshot` (the recipient's own location is theirs to hold precisely; the offer's exact point is not).
- A recipient is eligible when: `MeetOffer.status == active` AND recipient has `CityInterest.cityId == MeetOffer.cityId` AND `distance(recipient.LocationSnapshot, MeetOffer.placeGeohash) <= eligibilityRadiusKm[cityId]` (FR-004; resolved via `/speckit-clarify` — defaults to 5 km, configurable per city, see `research.md` §13)
- Ranking: offers whose city matches the recipient's *current* `LocationSnapshot` city rank above offers matching only another registered `City Interest` (FR-005, FR-023)
- Exposes `distanceBand`: `<1km | 1-5km | 5-15km | 15km+` (FR-026) — the only distance representation ever returned to a client before or after selection.
- Also maintains its own denormalized `interestCount`, sourced the same way as `MeetOffer.interestCount` (consuming `participation.interest-expressed`), so a feed response doesn't need a second round trip to Offer just to show the count (FR-042).

## Participation service

### ExpressionOfInterest
- `id` (uuid, pk)
- `offerId` (reference to Offer's MeetOffer)
- `recipientUserId`
- `message` (optional short text; max length **NEEDS CLARIFICATION**, spec Open Question re: FR-025)
- `createdAt`
- Rejected (not persisted) if `MeetOffer.status != active` at write time (FR-010) — enforced by revalidating Offer's contract synchronously, not by trusting a cached status.

### Selection
- `id` (uuid, pk)
- `offerId`
- `expressionOfInterestId`
- `selectedAt`
- `outcome`: `pending` → `happened` | `cancelled` (FR-038) — resolves to exactly one terminal value, no other state
- `cancelledBy`: `creator` | `recipient` | null — a creator revocation is stored identically to a recipient cancellation (Clarifications)
- Constraint: `count(Selection where offerId = X and outcome != cancelled) <= MeetOffer.capacity`; once written, `expressionOfInterestId` can never be swapped for another (Clarifications, spec Open Question 6).

## Messaging service

### Chat
- `id` (uuid, pk)
- `offerId`
- `status`: `active` | `archived_readonly` (set the moment any one Selection in the chat resolves to `cancelled`, via `participation.selection-resolved` — FR-038)
- `createdAt` (created on `participation.participant-selected`)

### ChatMembership
- `chatId`, `userId` (creator + every selected recipient for that offer — one shared group chat per FR-009)

### Message
- `id`, `chatId`, `senderUserId`, `body`, `sentAt`
- Retention/moderation rules: **NEEDS CLARIFICATION** (spec Open Question 9)

## Trust & Safety service

### Block
- `id`, `sourceUserId`, `targetUserId`, `status`: `pending_review` | `enforced` | `rejected`
- The submitter's own read-model view excludes `targetUserId` immediately on creation, independent of `status` (FR-015, Clarifications) — implemented as a per-viewer visibility filter, not a change to `targetUserId`'s own state.

### Report
- `id`, `reporterUserId`, `subjectType`: `user | offer | message | rating_feedback | photo`, `subjectId`, `status`, `createdAt`
- Never exposed to any user as profile information (constitution §3.V).

### RatingFeedback
- `id`, `offerId`, `selectionId`, `raterUserId`, `rateeUserId`
- `starRating` (scale **NEEDS CLARIFICATION**, spec Open Question 15)
- `writtenFeedback`
- `photoUrl?`, `photoConsent`: `{ subjectUserId, consentedAt }[]` — a photo showing an identifiable other person is not made public until every such consent row exists (FR-029)
- `visibility`: `pending_followup` | `public` | `removed`
- `promptSentAt` — set by an asynchronous delayed job triggered by `participation.selection-resolved` once `outcome == happened`, scheduled exactly 2 hours after that event (resolved via `/speckit-clarify`, spec.md FR-029).
- Eligibility precondition: created only when `Selection.outcome == happened`.

### TrustedContactSetting
- `id`, `userId`, `contactHandleEncrypted` (encrypted at rest; Highly Restricted — never returned in a list/discovery response, constitution §7), `sharingRule` — journey/turnaround details **NEEDS CLARIFICATION** (spec Open Question 9).

## Entitlements & Billing service

### PublishingEntitlementLedger
- `id`, `userId`, `calendarMonthKey` (derived from `User.registeredAddressCity`'s timezone mapping — **NEEDS CLARIFICATION**, spec Open Question 18)
- `freeOffersUsedThisMonth` (int, cap 3 — FR-030); incremented on every successful publish and never decremented afterward — a stopped or expired offer does not refund its slot, and a rebroadcast increments it again (resolved via `/speckit-clarify`, spec.md FR-030)
- `entries[]`: one row per publish attempt referencing `offerId`, `entitlementSource`: `free_allowance | one_time_purchase | subscription`, `reservedAt`, `releasedAt?` (released if the offer publish ultimately fails)

### Subscription
- `id`, `userId`, `plan`: `weekly | monthly | yearly`, `status`: `active | cancelled_pending_period_end | expired`
- `currentPeriodEnd`, `cancelledAt?` — cancellation always takes effect at `currentPeriodEnd`, no refund (FR-032)
- `basePriceMinor`, `discountPct` (10 for monthly, 20 for yearly, 0 for weekly — FR-037), `currency` — actual base price values are **NEEDS CLARIFICATION** (spec Open Questions 20-21)

### OneTimeBroadcastPurchase
- `id`, `userId`, `priceMinor`, `currency`, `status`: `granted | consumed`, `purchasedAt`, `consumedByOfferId?`
- Whether one purchase yields one reusable future broadcast or must be used immediately is **NEEDS CLARIFICATION** (spec Open Question 22).

## Notification service

### NotificationJob (not a spec-named entity — required by the architecture to satisfy FR-006)
- `id`, `userId`, `channel`: `push | in_app`, `templateKey`, `payloadRefIds`, `status`: `queued | sent | failed`, `createdAt`, `sentAt?`
- Idempotency key = `(eventId, userId, channel)` so a redelivered domain event never double-sends.

## Media service

### MediaAsset (not a spec-named entity — required by the architecture)
- `id`, `ownerUserId`, `kind`: `profile_photo | verification_id | verification_liveness | feedback_photo`, `storageRef`, `moderationStatus`, `uploadedAt`
- Referenced by id only from `User.photoUrl`, `RatingFeedback.photoUrl`, and Identity & Profile's `VerificationAttempt` — no other service reads `storageRef` directly.

## Cross-Service Reference Summary

| Referencing field | Owning service of the reference | Kept in sync via |
| --- | --- | --- |
| `MeetOffer.creatorUserId` | Identity & Profile | Read at publish time; cached snapshot of `firstName`/`photo`/`ageRange`/`verificationBadge` refreshed on a (not-yet-named) profile-updated event |
| `ExpressionOfInterest.offerId`, `Selection.offerId` | Offer | `offer.published`/`offer.stopped`/`offer.expired` events |
| `Chat.offerId` | Offer | `participation.participant-selected` event |
| `RatingFeedback.selectionId` | Participation | `participation.selection-resolved` event (fires when `outcome` becomes `happened` or `cancelled`) |
| `PublishingEntitlementLedger.entries[].offerId` | Offer | Synchronous authorize call at publish time (not eventual) — entitlement must be reserved before `MeetOffer` is persisted as `active` |
| `Discovery.DiscoveryEligibility.placeGeohash` | Offer | `offer.published` event — geohash only, never the exact coordinates (`contracts/events.md` Payload Minimization Rule) |

## Sensitive-Data Classification

Classifies every field above so a reviewer can check a new field's handling at a glance, independent of which entity it lives on (constitution §7).

| Classification | Examples in this model | Handling requirement |
| --- | --- | --- |
| Highly restricted | `UserAccount.dateOfBirth`, `VerificationCase.evidenceAssetId` target file, `MeetOffer.place.lat/lng`, `PaymentAuditEvent` provider tokens, `Report` evidence, `TrustedContactSetting.contactHandleEncrypted` | Owning-service-only access; encrypted at rest; never in a public API response, an analytics event, a standard log line, or a broadly-fanned-out domain event. |
| Restricted | `Message.body`, `VerificationCase.status` detail, `UserAccount.ageAssuranceStatus`, `NotificationJob` push tokens | Service-scoped access; redacted/omitted from logs and traces; retained only per an approved retention rule. |
| Controlled public | `PublicProfile.firstName/photoAssetId/ageRangeLabel/interests/verificationStatus`, `DiscoveryEligibility.distanceBand`, `RatingFeedback` once `visibility == public` | Returned only through the approved pre-/post-selection profile views (FR-013, FR-024); privacy/consent rules still apply per field. |
| Operational | Opaque ids, `MeetOffer.status`, timestamps, `eventType`, `aggregateVersion`, `placeGeohash` | Safe for events, traces, and metrics — cannot by itself identify or locate a specific person. |

## Schema Design Review Gates

Before any of these entities gets a physical migration, the linked approval must close (all tracked centrally in `docs/architecture/decisions.md`, not duplicated here):

1. `UserAccount`/`VerificationCase` — needs ADQ-002a (auth provider) and ADQ-002b (re-verification/launch countries).
2. `PublishingEntitlementLedger`/`RegisteredAddress.calendarTimezone` — offer-counting rule is resolved (every publish counts, no refund on stop/expire, rebroadcast counts again); still needs the city→timezone mapping (spec Open Question 18).
3. `RatingFeedback`/`MediaAsset` (feedback photo path) — needs ADQ-006 (moderation/trust operating model) and the consent-capture flow (spec Open Question 16).
4. `Message`/`Chat` retention fields — needs the retention/legal-hold answer under spec Open Question 9.

## Post-Design Constitution Re-Check

- No shared database or cross-service foreign key was introduced — every cross-service link above is an id reference resolved via an event or a synchronous authorization call, matching constitution §5.
- No client-facing field, and no domain event, exposes precise location before selection; `DiscoveryEligibility.distanceBand` (client-facing) and `placeGeohash` (event-facing) are the only location data that ever leaves Offer pre-selection, satisfying §3.IV. This was tightened during review: the first draft of `offer.published` carried exact `lat`/`lng` to every consumer including Notification — corrected in `contracts/events.md`.
- Sensitive fields (`ageAssuranceStatus` detail, `MediaAsset.storageRef`, payment identifiers, `TrustedContactSetting.contactHandleEncrypted`) stay inside their owning service and are never copied into a cross-service read model or event payload, satisfying §7's least-privilege rule — see the Sensitive-Data Classification table above.
- All `NEEDS CLARIFICATION` markers remaining in this data model are traceable to an already-open spec Open Question or an ADQ in `docs/architecture/decisions.md` — none is a new ambiguity introduced by this design pass. **Result: PASS** (no new Constitution Check violation from Phase 1 design; existing BLOCKED/OPEN gates in `plan.md` are unchanged and still gate `/speckit-tasks`, not this design).
