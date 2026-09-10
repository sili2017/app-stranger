# Quickstart: Validating Ephemeral Stranger Meet Offers

This is a validation guide, not an implementation guide — it maps each user story's "Independent Test" (`spec.md`) to a runnable check against the architecture in `plan.md`/`data-model.md`/`contracts/`. Fill in the exact CLI/script commands once `/speckit-tasks` produces real services; the scenarios and expected outcomes below do not change when that happens.

## Prerequisites
- All nine domain services + gateway running locally (`docker-compose up`, once `infra/docker/` exists), each with its own PostgreSQL database and a shared local Redis and event-bus emulator.
- Two seeded test users: **Creator** (registered address city = Mumbai, `ageAssuranceStatus: liveness_passed`) and **Recipient** (city interest = Mumbai, current `LocationSnapshot` within the eligibility radius of the Creator's planned offer location).
- A third seeded **OutOfRangeRecipient** (city interest = Mumbai, `LocationSnapshot` beyond the eligibility radius) for negative-case checks.

## Story 1 — Publish an immediate meet offer (P1)
1. As Creator, `POST /api/v1/offers` with activity "Sunny wants to drink tea" and a pin near CST Railway Station, omitting `lifetimeMinutes`.
   - Expect `201`, `lifetimeMinutes: 15` (FR-003 default), `status: active`.
2. Call `GET /api/v1/offers/{id}` after `lifetimeMinutes` elapses (or fast-forward the test clock).
   - Expect `status: expired`, and a subsequent `POST .../expressions-of-interest` returns `409 OFFER_NOT_ACTIVE`.
3. Publish a second offer, then as Creator `POST /api/v1/offers/{id}/stop`.
   - Expect `status: stopped` immediately, before `expiresAt`.
4. Publish an offer with a free-text activity not in any example list (e.g., "kite flying").
   - Expect `201` — confirms FR-018's "illustrative, not closed catalog" rule.
5. On an expired offer, call the rebroadcast endpoint.
   - Expect a **new** `MeetOffer.id` (never the same id reactivated), subject to the still-open rebroadcast reuse rule in `data-model.md`.

## Story 2 — Receive a relevant live offer (P1)
1. Publish a Mumbai offer as Creator.
2. As Recipient, `GET /api/v1/discovery/feed`.
   - Expect the offer present with a `distanceBand`, not an exact distance (FR-026).
3. As OutOfRangeRecipient, `GET /api/v1/discovery/feed`.
   - Expect the offer absent (FR-004's radius condition).
4. Give Recipient a second city interest whose city is not their current location; publish comparable offers in both cities.
   - Expect the current-location city's offer ranked first (FR-005).
5. After expiry, re-fetch the feed as Recipient.
   - Expect the expired offer absent.

## Story 3 — Accept an offer and coordinate (P1)
1. As Recipient, express interest on Creator's active offer with a short message.
   - Expect `201`; Creator's `GET /api/v1/offers/{id}/expressions-of-interest` lists it.
2. As Creator, select that expression of interest.
   - Expect `201 Selection`; both Creator and Recipient can `GET` the resulting `Chat` and see each other as members.
3. After the offer expires/stops, have a different eligible recipient attempt to express interest.
   - Expect `409 OFFER_NOT_ACTIVE` and no new `Chat`.
4. Either party posts a message in the chat.
   - Expect both members can read it.
5. Have a second eligible recipient express interest on an offer with capacity 1; Creator selects the first recipient only.
   - Expect the second (unselected) recipient receives no explicit non-selection notice (FR-008/FR-042, Open Question 6). Both recipients and any other viewer see `interestCount: 2` on the offer while it remains active — a non-identifying total, never a list of who expressed interest.

## Story 4 — Build trust through post-meeting feedback (P2)
1. Resolve a Selection to `outcome: happened` (no cancellation before the meetup).
   - Expect a `RatingFeedback` eligibility record created (async, per `participation.selection-resolved`), and the rating prompt delivered exactly 2 hours later, not instantly.
2. Submit a star rating + written feedback + a photo containing another identifiable person without that person's consent record.
   - Expect the photo withheld from public visibility until the consent row exists (FR-029); the rating/text may still follow the approved moderation path independently.
3. `GET` the rated user's profile as a third user.
   - Expect the approved public rating/trust information visible per FR-024/SC-011, and no private `Report` ever exposed.
4. Report a public feedback item.
   - Expect a `Report` created and the item's public visibility unaffected until moderation resolves it.

## Story 5 — Publish within a free allowance or subscription (P2)
1. As a fresh non-subscribing user, publish three offers within one calendar month (Mumbai-timezone boundary).
   - Expect each `201` with `remainingFreeAllowanceThisMonth` decrementing 2 → 1 → 0.
2. Attempt a fourth publish.
   - Expect `402 ENTITLEMENT_REQUIRED` with subscription/one-time-purchase options in the response body.
3. Activate a weekly subscription; publish again.
   - Expect `201` with no allowance decrement.
4. Cancel the subscription; publish again after `currentPeriodEnd`.
   - Expect the free-allowance rule reapplied (FR-033).
5. After exhausting the free allowance, complete the one-time purchase flow.
   - Expect exactly one additional successful publish attributable to that purchase.

## Cross-Cutting Checks
- **Idempotency**: replay any `POST` above with the same `Idempotency-Key` and body — expect the original response returned, no duplicate resource created (`api-standards.md`).
- **Event redelivery**: manually redeliver a `participation.participant-selected` event with an already-processed `selectionId` to Messaging — expect no duplicate `Chat`.
- **Data isolation**: attempt a query from one service's credentials against another service's database — expect it to fail at the connection/permission level, not merely at the application level (constitution §5, §7).
- **Browser parity**: repeat Stories 1-5 end-to-end in the Flutter Web build in a supported desktop browser instead of the mobile app — expect identical outcomes at every step (FR-041). Deny the browser's location permission prompt and expect the same last-known-location fallback as mobile (FR-005); confirm the in-app/in-browser live feed still surfaces new offers if the browser doesn't support push (FR-006).
- **Blocked-gate reminder**: this quickstart validates architecture and contracts only. Per `plan.md`'s Constitution Check, do not treat a green run here as clearance to release — the safety, payment, and event-transport gates listed there must still be resolved before external release (constitution §3.II, §9).
