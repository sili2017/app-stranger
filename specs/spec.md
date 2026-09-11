# Feature Specification: Ephemeral Stranger Meet Offers

**Feature Branch**: `[001-stranger-meet-offers]`

**Created**: 2026-09-10

**Status**: Draft — refined 2026-09-10; requires product-owner clarification before planning

**Architecture Context**: The approved architecture direction is a frontend-neutral, layered microservice platform (Flutter clients, Node.js/TypeScript services, PostgreSQL per service). See [plan.md](./plan.md) and [../docs/architecture/decisions.md](../docs/architecture/decisions.md).

**Input**: User description: "Registered adult users aged 18+ can create short-lived offers/events to meet a stranger for an activity at a specific, selected, live, or moving place. Users with the relevant city registered as an interest receive offers, with nearest events prioritized. Interested users express interest; the creator selects how many to admit and can stop an active offer. The default lifetime is 15 minutes and creators can configure it and rebroadcast after expiry. Profiles display first name, photo, age range, interests, verification badge, and distance. Photo and government-ID verification are encouraged but do not block use. V1 safety capabilities include blocking/reporting, content moderation, emergency guidance, trusted-contact sharing, and ratings/reviews. Paid meetings, private homes, dating/romantic offers, and any use by or activity involving minors are prohibited. A non-subscribing user may broadcast at most three offers per calendar month determined by their registered-address city; an additional single offer costs the local-currency equivalent of USD 1. Automatically renewing weekly, monthly, and yearly subscriptions allow unlimited broadcasts while active and can be cancelled. Monthly subscriptions receive a 10% discount and yearly subscriptions receive a 20% discount."

## Clarifications

### Session 2026-09-10

- Q: What is the minimum age-assurance mechanism required at signup, given verification must not block core use? → A: Self-declared date of birth at signup, plus a mandatory photo liveness check. If the photo check flags the user as a possible minor despite their 18+ attestation, the system requires mandatory government-ID document upload before that user's first offer can be published.
- Q: When should an offer's 15-minute countdown timer start? → A: On publish confirmation — the moment the system saves the offer as active.
- Q: What configurable range should creators have for an offer's lifetime? → A: 5–30 minutes; the default remains 15 minutes.
- Q: When can the exact meeting place (pin, live location, or moving-place updates) be revealed to a recipient? → A: Only after the creator selects that recipient. Before selection, recipients see only an approximate place/distance band.
- Q: When a creator selects multiple recipients for the same offer, how should chat work? → A: One shared group chat including the creator and all selected recipients.
- Q: After the creator selects a recipient, can either party back out of that specific meetup, and what happens to the chat if they do? → A: Either party can cancel their participation. The chat becomes read-only/archived but isn't deleted, preserving a record for a possible report or safety review. Once selected, the meetup either happens or is cancelled — there is no other outcome.
- Q: Given ratings are an async follow-up (not instant), what determines whether a meeting counts as "happened" and becomes eligible for the follow-up rating prompt? → A: A meeting is treated as having happened unless either party cancelled beforehand; the rating prompt is sent as a delayed, asynchronous follow-up rather than instantly during or right after the meeting.
- Q: When a user blocks another user, what should happen immediately? → A: The block request is routed to moderation review before it takes effect on visibility or contact between the two users.
- Q: How should the optional money-related field (creator-pays / BYO / split-the-bill / estimated cost) be constrained to prevent it enabling paid meetings? → A: Selectable labels (creator-pays, bring-your-own, split-the-bill, estimated cost) plus a short free-text note, moderated after publish.
- Q: Beyond registering the offer's city as an interest, should any other filter apply before a user is counted as an eligible recipient? → A: Both apply — the recipient must have the offer's city registered as an interest AND be within a configurable distance/radius of the offer's location.

### Session 2026-09-10 (continued)

- Q: When a user cancels an auto-renewing subscription, when does the cancellation take effect? → A: At the end of the current paid period; entitlement continues until then, no refund.
- Q: What current-location behavior is required for prioritizing "nearby" offers? → A: Device GPS sampled periodically while the app is open; when live GPS is unavailable, fall back to the user's last known location.
- Q: Can rating/feedback photos show another identifiable person, and if so what consent is required? → A: Yes, but only with that person's explicit in-app consent captured before the photo is made public.
- Q: What notification channel and delivery-time target apply for alerting eligible recipients, given the 5–30 minute offer lifetime? → A: Push notification targeting delivery within approximately 30 seconds of publish, with the in-app live feed as a fallback.
- Q: After publishing an offer, can the creator change the capacity (how many recipients to admit) while it's still active? → A: No — capacity is fixed at publish time and cannot be changed while active.

### Session 2026-09-10 (round 4)

- Q: If a user's mandatory government-ID upload is rejected, or they believe the minor-flag was a mistake, what should happen? → A: They can submit a manual appeal; the account stays restricted from publishing until the appeal is resolved.
- Q: For a moving/transient place, how should location updates reach already-selected recipients? → A: The place is captured as a single snapshot at the moment the offer is published (when the notification goes out); the system does not continue updating or re-disclosing location after that, even for a moving/transient place.
- Q: What are the capacity limits, and can the creator swap a previously selected recipient for someone else before the offer expires? → A: Capacity ranges 1–10; selections are final once made, no swapping.
- Q: When either party cancels after selection, what does the other party see, and is a creator's revocation treated the same as a cancellation? → A: The other party gets a push + in-app notification. A creator revoking a selection is treated identically to a cancellation — one unified concept.
- Q: What distance precision should be shown, and can an unverified user hide the "unverified" status? → A: Distance bands (e.g. <1km, 1–5km, 5–15km, 15km+); unverified users cannot hide their status — the badge is simply absent until verified.
- Q: While a block or report is under moderation review, what protection applies to the person who submitted it? → A: The submitter's own view updates immediately (they stop seeing the other user), even though full mutual enforcement is still pending review.
- Q: How should the system prevent or catch offers for prohibited/high-risk activities? → A: Automated keyword/content screening at publish time only; v1 does not require human moderation review before an offer goes live.
- Q: What should the primary v1 success metric be? → A: Offer-to-interest conversion rate (share of published offers that receive at least one expression of interest).
- Q: Must the creator explicitly choose between Google Maps and Apple Maps, or should the app pick automatically? → A: Automatic — the platform default (Apple Maps on iOS, Google Maps on Android), no explicit choice required.
- Q: Which filters are required in the v1 discovery feed? → A: Activity, distance band, and time remaining.

### Session 2026-09-10 (round 5)

- Q: Should the v1 automated-only content screening apply to every offer, or should high-risk activity categories (e.g., alcohol, age-restricted) require human moderation review before publish? → A: Automated-only screening applies to every offer, including high-risk categories; no human review is required before publish in v1.

### Session 2026-09-10 (round 6)

- Q: What is the default eligibility radius — the maximum distance from an offer's location within which a recipient with that city registered as an interest counts as eligible? → A: 5 km by default, configurable per city (not a single fixed system-wide value).
- Q: When counting a user's three free offers for the calendar month, should a stopped, expired, or rebroadcast offer count toward that limit, or does only the original successful publish count? → A: Every successful publish counts, regardless of what happens to it afterward; stopping or expiring an offer does not refund the slot, and a rebroadcast is a new publish that counts again.
- Q: What must a creator provide for a moving or transient place (e.g., a moving train, a queue) beyond the single GPS snapshot captured at publish? → A: A required short free-text rendezvous instruction (e.g., "how to find me") alongside the GPS snapshot, for `moving` places and queue-style locations without a fixed venue.
- Q: How long after a completed (non-cancelled) meeting should the asynchronous rating/feedback prompt be sent? → A: 2 hours after the selection resolves to "happened."
- Q: When the creator selects some, but not all, of the interested recipients on an offer, when should the unselected recipients be told they weren't chosen? → A: They are not explicitly told — no non-selection notice is sent in this partial-selection case (this is separate from FR-027's zero-selection case, which is unchanged). Instead, while the offer is active, the total number of expressions of interest is visible to any viewer who can see the offer, as a live indicator of how much response it is getting. Once the offer expires or is stopped, it becomes part of the creator's past-offer history per the existing FR-012 requirement.

### Session 2026-09-10 (round 7)

- Q: Should a person be able to use Stranger fully in a browser, without installing the app? → A: Yes — full feature parity in-browser (publish, discover, express interest, select, chat, everything), not a limited browse-only experience.
- Q: Should browser support ship in the same v1 release as the mobile app, or as a fast-follow afterward? → A: Same v1 release. FR-041 changes from "web not required for v1" to "web required for v1, full parity with the mobile app."

### Session 2026-09-11

- Q: What's the maximum time a block or report submission should wait for moderation review before it takes effect broadly (beyond the submitter's own immediate view update)? → A: Within 4 hours of submission.
- Q: How often should the app sample GPS for a recipient's current location, and how long should a last-known location remain usable before it's treated as stale? → A: 60-second sample interval while the app is open; a last-known location is usable for up to 10 minutes before it is treated as stale.
- Q: When a creator rebroadcasts an expired offer, does the system create a fresh offer pre-filled with the previous offer's details for review/edit, or republish immediately unchanged? → A: Pre-fill all fields from the prior offer; the creator reviews/edits then confirms, and a new GPS/place snapshot is captured at that re-confirmation (per the existing single-snapshot-at-publish rule, FR-002). No rebroadcast-specific rate/cap limit applies beyond the existing monthly free-allowance/subscription entitlement rule (FR-030).
- Q: Should the distance-band thresholds already used as examples throughout the spec (<1 km, 1–5 km, 5–15 km, 15+ km) become the final, confirmed v1 bands? → A: Yes — confirmed as final: <1 km, 1–5 km, 5–15 km, 15+ km.
- Q: When an eligible recipient has denied or not granted push-notification permission, how should the system make sure they still learn about relevant active offers in time? → A: Show a persistent in-app banner/badge encouraging the user to enable notifications, in addition to relying on the in-app live feed as the fallback channel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish an immediate meet offer (Priority: P1)

As a person who would like company for an activity at a specific place, I can create and publish a short-lived offer describing the activity and place so that relevant people have an immediate opportunity to join me.

**Why this priority**: This is the core value proposition. Without a live offer, there is nothing to discover or accept.

**Independent Test**: A registered user publishes an offer such as “Sunny wants to drink tea” at a named tea stall outside CST Railway Station, can see its configured active period, and can stop it before expiration.

**Acceptance Scenarios**:

1. **Given** a user is able to create an offer, **When** they provide an allowed activity, a meeting-place representation, and publish it without selecting a lifetime, **Then** the system creates an active meet offer with a 15-minute default lifetime.
2. **Given** an active meet offer, **When** its configured lifetime has elapsed, **Then** the offer is no longer open to new expressions of interest and is shown as expired rather than active.
3. **Given** an active meet offer, **When** its creator stops it before expiration, **Then** the offer is no longer open to new expressions of interest and is shown as stopped.
4. **Given** a user enters an allowed activity not represented in the supplied examples, **When** they publish it with a meeting place, **Then** the system treats it as an activity offer rather than rejecting it solely because it is not tea, coffee, or another example activity.
5. **Given** the creator views a past offer, **When** they choose to rebroadcast it after expiry, **Then** the system creates a new active offer subject to the approved rebroadcast rules.

---

### User Story 2 - Receive a relevant live offer (Priority: P1)

As a person interested in meeting people in a city, I can receive or see active offers relevant to my registered city interests, with offers near my current location prioritized, so that I can react quickly to an opportunity that is practical for me.

**Why this priority**: The offer only creates value if a potential participant can discover it while it is active.

**Independent Test**: Configure one recipient with Bombay/Mumbai as a registered city interest and a current location near the offer place. Publish a Bombay offer and verify the recipient is selected as relevant and the offer is prioritized ahead of otherwise comparable offers from a non-current registered city.

**Acceptance Scenarios**:

1. **Given** a recipient has registered interest in the offer's city, **When** an active offer is published for that city, **Then** the recipient is eligible to receive or see the offer while it remains active.
2. **Given** a recipient has registered interest in multiple cities and is currently located in one of them, **When** comparable active offers exist for those cities, **Then** offers associated with the recipient's current location are prioritized over offers for their other registered city interests.
3. **Given** an offer has expired, **When** a recipient opens or receives the live-offer experience, **Then** the expired offer is not presented as an offer they can accept.

---

### User Story 3 - Accept an offer and coordinate (Priority: P1)

As a person who sees an active offer, I can express interest in joining it; if the creator selects me, I can begin a chat with the creator so that we can coordinate the proposed meeting.

**Why this priority**: Expressing interest, creator selection, and coordination convert discovery into the intended real-world connection while giving the creator control over attendance.

**Independent Test**: While an offer is active, an eligible recipient expresses interest. The creator selects the recipient and a chat becomes available to both; after expiry, a new expression of interest is rejected.

**Acceptance Scenarios**:

1. **Given** an eligible recipient sees an active offer, **When** they express interest before the offer expires, **Then** the system records that interest and presents it to the creator.
2. **Given** an active offer has interested recipients, **When** the creator selects one or more recipients, **Then** the system creates a chat channel between the creator and each selected recipient subject to the approved chat membership rule.
3. **Given** an offer has expired or has been stopped, **When** a recipient attempts to express interest, **Then** the system does not record a new interest or create a new chat and explains that the offer is no longer active.
4. **Given** a recipient is selected, **When** either party opens the resulting conversation, **Then** they can use the chat to coordinate the meeting subject to the approved chat and safety rules.

---

### User Story 4 - Build trust through post-meeting feedback (Priority: P2)

As a person who has met through Stranger, I can rate and give feedback about the other participant so that future users have public trust information when considering an offer or an expression of interest.

**Why this priority**: Trust information is important to repeat use and safety, but the core live-offer, interest, selection, and chat journey can be validated before public feedback is released.

**Independent Test**: After a qualifying completed meeting, each participant can submit a star rating and written feedback. The approved public rating is visible to future users, while the participant can report inappropriate feedback or photos.

**Acceptance Scenarios**:

1. **Given** a meeting meets the approved eligibility rule for feedback, **When** a participant submits a star rating and written feedback for the other participant, **Then** the system records the feedback and makes the approved public trust information available on the rated user's profile.
2. **Given** a participant wants to include a photo with feedback, **When** the photo is submitted, **Then** the system applies the approved consent and moderation rules before making it public.
3. **Given** a user sees a prospective creator or interested recipient, **When** they review that person's profile, **Then** they can see the approved public rating/trust information alongside the profile information already approved for that journey.
4. **Given** public feedback or a photo is inappropriate, false, or unsafe, **When** a user reports it, **Then** the system processes the report according to the approved moderation and appeal rules.

---

### User Story 5 - Publish within a free allowance or subscription (Priority: P2)

As a user, I can see my remaining free broadcasts and choose a renewable subscription when I need unlimited publishing, so that I understand and can manage the publishing entitlement that applies to me.

**Why this priority**: The free allowance provides an initial path to value, while subscription supports sustainable monetization for users who publish more frequently.

**Independent Test**: A non-subscribing user publishes three offers in one calendar month and sees that a fourth cannot be published without an active eligible subscription. Activate each subscription period and verify that the user can publish without the monthly free-offer limit while it remains active.

**Acceptance Scenarios**:

1. **Given** a non-subscribing user has published fewer than three offers in the applicable calendar month, **When** they publish another valid offer, **Then** the system allows publication and updates the displayed remaining free allowance.
2. **Given** a non-subscribing user has already broadcast three offers in the applicable calendar month, **When** they attempt to publish another offer, **Then** the system prevents publication and presents the available subscription options.
3. **Given** a user has an active eligible weekly, monthly, or yearly subscription, **When** they publish a valid offer, **Then** the system permits publication without applying the three-offer monthly free allowance.
4. **Given** a user's subscription is no longer active, **When** they attempt to publish an offer, **Then** the system applies the free monthly allowance that is applicable at that time.
5. **Given** a non-subscribing user has used the applicable free monthly allowance, **When** they choose the single-offer purchase option and the purchase succeeds, **Then** the system allows one additional valid offer to be broadcast.
6. **Given** a user has an active auto-renewing subscription, **When** they cancel it, **Then** the system prevents a future automatic renewal and preserves the entitlement through the approved end of the already-paid subscription period.

### Edge Cases

- What happens if an offer expires while a recipient is opening or submitting an expression of interest?
- How does the system prevent an offer that is associated with a city interest from being treated as a nearby/current-location offer when its location is unknown or stale?
- How does the system handle several people expressing interest while the creator is making selections, including changes to the creator's intended capacity?
- What happens if the creator or recipient loses connectivity during publication, notification delivery, expression of interest, selection, or chat creation?
- What happens when an activity is lawful but high-risk, age-restricted, or inappropriate for the target audience (for example alcohol, smoking, a boat trip, or an activity involving a private venue)?
- What can a user see or do after an offer expires: view history, continue a chat, cancel a selected meeting, or neither?
- What confirms that a meeting occurred and is eligible for ratings, and how does the system prevent retaliatory, fabricated, or coercive public feedback?
- What consent is required before a participant uploads a photo of another person as public feedback?
- What happens when a subscription starts, renews, fails to renew, is cancelled, expires, is refunded, or is purchased on another device?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to create and publish a meet offer for a generic activity at a specific place.
- **FR-002**: The system MUST let a creator specify a meeting place using typed text, a map pin, a selected venue, live location, or a combination of these. The place model MUST support a moving or transient context such as a moving train or a queue; for a `moving` place or a queue-style location without a fixed venue, the system MUST additionally require a short free-text rendezvous instruction (e.g., "how to find me") alongside the GPS snapshot. Before creator selection, recipients MUST see only an approximate place/distance band; the exact pin, venue address, live/moving location, and rendezvous instruction MUST be disclosed only after the creator selects that recipient.
- **FR-003**: The system MUST apply a 15-minute default active lifetime to a published offer, MUST let its creator configure the lifetime between 5 and 30 minutes, and MUST start the countdown at publish confirmation (the moment the system saves the offer as active). The system MUST prevent new expressions of interest after the offer expires.
- **FR-004**: The system MUST use a recipient's registered city interests when determining whether an active offer is relevant to that recipient. A recipient MUST additionally be within a distance/radius of the offer's location to be counted as an eligible recipient; the radius defaults to 5 km and MUST be configurable per city (not a single fixed system-wide value).
- **FR-005**: When a recipient has multiple registered city interests, the system MUST prioritize offers associated with the recipient's current location over otherwise comparable offers for other registered city interests. Current location MUST be sampled via device GPS every 60 seconds while the app is open; when live GPS is unavailable, the system MUST fall back to the recipient's last known location, which remains usable for up to 10 minutes before it MUST be treated as stale. **[NEEDS CLARIFICATION: define the "nearby" radius/threshold and permission-denied behavior.]**
- **FR-006**: The system MUST present or notify eligible recipients of an offer only while the offer is active, via push notification targeting delivery within approximately 30 seconds of publish, with the in-app live feed as a fallback channel. When push-notification permission is denied or not granted, the system MUST show a persistent in-app banner/badge encouraging the user to enable notifications, in addition to relying on the in-app live feed fallback. **[NEEDS CLARIFICATION: define the measurement/alerting approach for the 30-second delivery target.]**
- **FR-007**: The system MUST allow an eligible recipient to express interest in an active offer.
- **FR-008**: The system MUST allow the creator to select which interested recipients join an offer, up to a capacity the creator sets at publish time. Capacity MUST be fixed once the offer is published and MUST NOT be changed while the offer is active. When the creator selects fewer recipients than expressed interest, an unselected recipient MUST NOT receive an explicit non-selection notice — this partial-selection case is distinct from FR-027, which covers an offer that expires with zero selections.
- **FR-009**: The system MUST create a chat channel after the creator selects an interested recipient. When a creator selects multiple recipients for the same offer, the system MUST place the creator and all selected recipients into one shared group chat.
- **FR-010**: The system MUST reject an expression of interest that reaches the system after the offer has expired or been stopped and MUST not create a chat from that rejected attempt.
- **FR-011**: The system MUST allow the creator to stop an active offer until it expires; a stopped offer MUST not accept new expressions of interest.
- **FR-012**: The system MUST retain a creator-visible history of past offers and MUST allow the creator to rebroadcast an expired offer. Rebroadcasting MUST create a new offer pre-filled with the expired offer's details for the creator to review and edit; confirming the rebroadcast MUST capture a new place/GPS snapshot at that moment (per FR-002's single-snapshot rule) and MUST count toward the creator's monthly free-allowance/subscription entitlement exactly as any other publish (FR-030), with no additional rebroadcast-specific rate or cap limit.
- **FR-013**: Before a recipient expresses interest, the system MUST display the offer creator's first name, photo, age range, interests, verification badge, and distance, subject to approved privacy and location-disclosure rules.
- **FR-014**: The system MUST support optional photo and government-ID verification during account creation without blocking an unverified registered user from using the core offer experience. The system MUST visibly reflect completed verification on the profile and MAY prompt unverified users to complete it. An unverified user MUST NOT be able to hide or suppress the absence of the verification badge; the badge is simply not shown until verification is completed. This optional profile verification is distinct from the mandatory signup-time age-assurance check in FR-016 and does not itself gate core use. **[NEEDS CLARIFICATION: determine which verification states, checks, and incentives apply.]**
- **FR-015**: The system MUST provide v1 block/report, content-moderation, emergency-guidance, trusted-contact-sharing, and ratings/reviews capabilities. A block or report request MUST be routed to moderation review before it takes effect broadly (on visibility or contact between the two users), but the submitting user's own view MUST update immediately so they stop seeing the blocked user, independent of the pending review outcome. Moderation review of a block/report request MUST complete within 4 hours of submission. **[NEEDS CLARIFICATION: define the exact user journeys, privacy boundaries, and enforcement rules for content moderation, emergency guidance, trusted-contact sharing, and data retention.]**
- **FR-016**: The system MUST permit use only by users aged 18 or older and MUST prohibit paid meetings, offers at private homes, dating/romantic offers, and offers involving minors. Age assurance at signup MUST require a self-declared date of birth and a mandatory photo liveness check; if the photo check flags the user as a possible minor despite a self-declared 18+ date of birth, the system MUST require government-ID document upload before that user's first offer can be published. **[NEEDS CLARIFICATION: define ongoing/periodic re-verification, post-signup detection, reporting, enforcement actions, appeal for an incorrectly triggered ID escalation, and launch countries.]**
- **FR-017**: The system MUST communicate the active, stopped, expired, and selected/not-selected states of an offer clearly to the creator and relevant recipients.
- **FR-018**: The system MUST support activities beyond the supplied examples; the examples are illustrative rather than a fixed activity catalog. **[NEEDS CLARIFICATION: decide whether activity text is free-form, selected from categories, or a combination.]**
- **FR-039**: The system MUST screen offer activity text via automated keyword/content screening at publish time to block obvious violations of the prohibited-activity rules in FR-016 (paid meetings, private-home offers, dating/romantic framing, and other disallowed activities). Human moderation review is NOT required before an offer publishes in v1, including for high-risk activity categories such as alcohol or other age-restricted activities; the product owner has confirmed this automation-only screening approach applies to every offer. **[NEEDS CLARIFICATION: define the automated screening rule set and its false-positive/false-negative handling.]**
- **FR-040**: The application MUST display static and system-generated user-interface content in the language indicated by the user's device locale when that language is supported, MUST let the user select a supported language override, and MUST fall back to English when the device language is unsupported. User-created content (activity text, expression-of-interest messages, chat, written feedback) is displayed only in its original language; automatic translation of user-created content is out of scope unless separately specified. **[NEEDS CLARIFICATION: approve the initial list of supported languages and whether a language preference syncs across a user's devices.]**
- **FR-041**: The product MUST be usable on Android and iOS phones and tablets, and in a desktop/laptop/Chromebook browser, through a frontend-neutral API (no client accesses a service database or holds domain rules directly). Browser access MUST offer full feature parity with the app for the v1 release covered by this spec — publish, discover, express interest, select, and chat all work without installing anything. Because a browser's location and notification permissions behave differently from a native mobile OS (per-session prompts, inconsistent push support across browsers), the system MUST apply the same permission-denied and delivery-fallback rules already defined for mobile (FR-005's last-known-location fallback, FR-006's in-app/in-browser live-feed fallback) to the browser client as well. **[NEEDS CLARIFICATION: confirm the v1 accessibility standard (e.g., WCAG level) and the supported-browser/version matrix (e.g., current Chrome, Safari, Firefox, Edge).]**
- **FR-042**: While an offer is active, the system MUST show the total number of expressions of interest it has received to any viewer who can see the offer (the creator and eligible recipients), as a non-identifying live count, so viewers can gauge how much response the offer is getting. This count is not itself carried forward beyond what FR-012's creator-visible offer history already retains once the offer becomes inactive. **[NEEDS CLARIFICATION: define the refresh cadence for this live count (real-time vs. a periodic interval, consistent with FR-022's feed-refresh behavior).]**
- **FR-019**: The system MUST provide product controls and policies for age eligibility, identity/profile visibility, precise-location disclosure, consent, blocking, reporting, harmful-content handling, and retention of offer/chat/location data before any external release. **[NEEDS CLARIFICATION: all listed policy decisions remain open.]**
- **FR-020**: The offer-creation experience MUST be minimal. It MUST require an activity and either a map pin — selected automatically via the platform default map provider (Apple Maps on iOS, Google Maps on Android) with no explicit provider choice required from the creator — or a live location; any further offer fields are optional unless later approved. **[NEEDS CLARIFICATION: define fallback behavior on a platform/device where the default map provider is unavailable.]**
- **FR-021**: While a creator enters an activity, the system MUST offer optional assistance such as common-activity suggestions and emoji/smiley suggestions. It MUST not require a suggested activity or emoji to publish an otherwise allowed offer.
- **FR-022**: The system MUST provide a nearby live feed/map, a city-based feed, and search/filtering for discovery of active offers, in addition to the push notifications required by FR-006, with filters for activity, distance band, and time remaining. **[NEEDS CLARIFICATION: define map/fallback behavior and feed refresh behavior.]**
- **FR-023**: A user MAY register interest in any number of cities or places. Offer ranking MUST continue to prioritize physical proximity/current location over merely registered interests, subject to the approved relevance and privacy rules.
- **FR-024**: Before a creator selects an interested recipient, the system MUST show the recipient's approved profile information, including first name, photo, age range, interests, verification badge, distance band, and public rating/trust information. **[NEEDS CLARIFICATION: mutual-interest display and whether private reports are visible to creators; private reports must not be publicly exposed.]**
- **FR-025**: The system MUST allow an interested recipient to attach a short text message to their expression of interest. **[NEEDS CLARIFICATION: define maximum length, language support, moderation, and edit/delete rules.]**
- **FR-026**: The system MUST display distance using the following distance bands rather than an exact distance: <1 km, 1–5 km, 5–15 km, 15+ km. **[NEEDS CLARIFICATION: define the location source/freshness used to compute the band, and the point in the journey at which distance is first shown.]**
- **FR-027**: If an offer expires without the creator selecting an interested recipient, the system MUST tell each interested recipient that the offer expired without selection.
- **FR-028**: The system MUST support optional money-related information when an offer is published, presented as selectable labels (creator-pays, bring-your-own, split-the-bill, or estimated cost) plus an optional short free-text note; free-text notes MUST be moderated after publish. This information MUST describe meeting expenses and MUST NOT enable paid meetings. **[NEEDS CLARIFICATION: define the free-text character limit, moderation turnaround, currencies for estimated cost, and enforcement for violations.]**
- **FR-029**: A meeting qualifies as completed, and its participants become eligible for follow-up rating, when the associated selection was not cancelled by either party before the meetup (see FR-038). The system MUST send the rating and feedback prompt as an asynchronous follow-up exactly 2 hours after the selection resolves to "happened," not instantly during or immediately after the meeting. The system MUST allow participants to provide public star ratings, written feedback, and photos about one another through that follow-up. A feedback photo that shows another identifiable person MUST NOT be made public without that person's explicit in-app consent captured before publication. **[NEEDS CLARIFICATION: define the rating scale, whether feedback is mutual/one-way, the consent-capture flow and revocation, display rules, moderation, reporting, removal, and appeals.]**
- **FR-030**: A user without an active eligible subscription MUST be allowed to broadcast no more than three offers per calendar month. The applicable calendar month MUST be determined from the city in the user's registered address. Every offer that successfully publishes (passes content screening and entitlement authorization) MUST count toward that month's limit regardless of whether it is later stopped early or allowed to expire; a rebroadcast of an expired offer MUST count as a new publish. **[NEEDS CLARIFICATION: define how the registered-address city maps to a calendar/time zone, address-change timing, and how abuse or system failures affect the count.]**
- **FR-031**: The system MUST show a non-subscribing user their remaining monthly free broadcast allowance before or while they attempt to publish an offer.
- **FR-032**: The system MUST offer automatically renewing weekly, monthly, and yearly subscriptions that permit unlimited offer broadcasts while active. The user MUST be able to cancel a subscription; cancellation MUST take effect at the end of the current paid period, with the entitlement continuing until then and no refund for the remaining period. **[NEEDS CLARIFICATION: define trial/promotion rules, store/payment channels, refund exceptions, restoration, and regional availability.]**
- **FR-033**: The system MUST apply the free broadcast allowance again when a subscription is no longer active, subject to the approved subscription-state and calendar-month rules.
- **FR-034**: The system MUST communicate a user's current publishing entitlement and subscription state clearly, including blocked publication caused by reaching the free allowance. **[NEEDS CLARIFICATION: define failed renewal, refund, restore-purchase, and support/appeal behavior.]**
- **FR-035**: After a non-subscribing user has used the applicable three-offer monthly allowance, the system MUST offer a one-time option to purchase one additional broadcast at a configurable local-currency price whose initial reference value is USD 1. **[NEEDS CLARIFICATION: define taxes/fees, country-specific conversion/rounding, refund rules, and whether a purchase applies to any one future offer or must be used immediately.]**
- **FR-036**: The system MUST price offers and subscriptions in the user's applicable country/location currency, using USD as the initial business reference currency. The pricing configuration MUST support location/country-specific values. **[NEEDS CLARIFICATION: define the authoritative location/country, currency conversion source, taxation, and when prices may change.]**
- **FR-037**: The configured monthly subscription price MUST include a 10% discount, and the configured yearly subscription price MUST include a 20% discount. **[NEEDS CLARIFICATION: define the undiscounted reference price for each discount, the weekly subscription price, and whether discounts stack with other promotions.]**
- **FR-038**: After a creator selects a recipient, either the creator or the selected recipient MUST be able to cancel their participation in that meetup; a creator revoking a selection is treated identically to a cancellation. Once selected, the meetup's outcome MUST resolve to either "happened" or "cancelled" with no other state. When either party cancels, the system MUST send the other party a push and in-app notification, and the associated chat MUST remain visible in a read-only/archived state rather than being deleted.

### Key Entities *(include if feature involves data)*

- **User**: A registered adult aged 18 or older who can create offers, register city interests, receive relevant offers, express interest, and participate in chats when selected.
- **Verification Status**: The user's completed or incomplete *optional* photo and government-ID verification state, reflected on the profile; optional verification is not a core-use prerequisite. This is distinct from the *mandatory* signup-time age-assurance check (self-declared date of birth plus a photo liveness check, escalating to mandatory government-ID upload only if the photo check flags the user as a possible minor).
- **City Interest**: A city a user has deliberately registered as relevant for offers; a user may have more than one. Eligibility for a specific offer requires both the registered city interest and being within that city's eligibility radius (default 5 km, configurable per city) of the offer's location (see FR-004).
- **Current Location**: The user's present location, sampled via device GPS every 60 seconds while the app is open and used to prioritize relevant offers when available and permitted; falls back to the user's last known location (usable for up to 10 minutes before being treated as stale) when live GPS is unavailable. Its precision threshold and visibility are unresolved.
- **Meet Offer**: A time-bound invitation created by one user for an activity at a specific, selected, live, or moving place. It has an activity, place, city association, creator, a creator-selected lifetime (5–30 minutes, default 15, counted from publish confirmation), a recipient capacity fixed at publish time (cannot change while active — see FR-008), status (active/stopped/expired), expiry, and a live, publicly visible count of its current expressions of interest while active (see FR-042).
- **Expression of Interest**: A recipient's request to join a specific active meet offer, awaiting creator selection.
- **Selection**: The creator's decision to admit an interested recipient to an offer, up to a fixed capacity of 1–10 set at publish time; a selected recipient cannot be swapped for another. Once made, a selection's outcome resolves to "happened" or "cancelled" (see FR-038); either party may cancel their participation, which notifies the other party and leaves the associated chat read-only rather than deleting it.
- **Chat**: A conversation created after a creator selects an interested recipient, for coordination; when a creator selects multiple recipients for the same offer, they share one group chat with the creator. Message, moderation, and retention rules are unresolved.
- **Meeting Expense Preference**: Optional, non-payment information in an offer stating whether the creator pays, each person brings their own, costs are split, or an estimated cost. It must not represent payment for meeting or companionship.
- **Rating and Feedback**: Public trust information submitted through an asynchronous follow-up after a qualifying (non-cancelled) meeting, consisting of a star rating, written feedback, and optionally photos, subject to consent and moderation.
- **Publishing Entitlement**: The current rule determining whether a user may broadcast an offer: the non-subscribing monthly allowance or an active subscription with unlimited broadcasts.
- **Subscription**: An automatically renewing weekly, monthly, or yearly entitlement that allows unlimited offer broadcasts while active and can be cancelled; cancellation takes effect at the end of the current paid period with no refund for the remaining period. Price, billing, trial/promotion rules, and regional availability are unresolved.
- **One-Time Broadcast Purchase**: A paid entitlement to broadcast one additional offer after the non-subscribing free monthly allowance is used. Its initial business reference price is USD 1, with local-currency pricing configured by location/country.
- **Registered Address City**: The city held in a user's registered address, used to determine the calendar month for the non-subscribing broadcast allowance. Address verification, changes, and its mapping to a time zone are unresolved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of offers with no creator-selected lifetime are created with a 15-minute default; no offer is open to new expressions of interest after its configured expiry or creator stop event.
- **SC-002**: In acceptance testing, a recipient with the offer city registered as an interest and located within that city's eligibility radius (default 5 km, configurable per city) is selected as eligible for that offer, while a recipient missing either condition is not selected unless a future approved matching rule says otherwise.
- **SC-003**: In acceptance testing with a current location in one of several registered cities, an otherwise comparable offer for that current city ranks ahead of an offer for another registered city.
- **SC-004**: In acceptance testing, a pre-expiry expression of interest is visible to the creator, and a creator selection results in a chat available to both parties; an expired or stopped-offer expression of interest results in no new chat.
- **SC-005**: In acceptance testing, each profile exposes the agreed pre-interest information—first name, photo, age range, interests, verification badge, and distance—according to the approved privacy policy.
- **SC-006**: In acceptance testing, an unverified registered user can use the approved core offer experience and a completed photo/government-ID verification is visibly reflected on the profile.
- **SC-007**: In acceptance testing, users can find and invoke block/report, emergency-guidance, trusted-contact-sharing, and rating/review capabilities from their approved journeys; an account known to belong to a minor cannot use the app.
- **SC-008**: The primary v1 success metric is the offer-to-interest conversion rate (share of published offers that receive at least one expression of interest). **[NEEDS CLARIFICATION: baseline, target population, measurement period, and target value for this metric; secondary metrics for creator selection, meeting completion, repeat use, safety reports, and user satisfaction remain undefined.]**
- **SC-009**: In acceptance testing, a creator can publish an allowed offer by providing an activity plus a map pin or live location, without being required to provide nonessential offer fields; optional activity and emoji suggestions do not block publication.
- **SC-010**: In acceptance testing, a user can discover active eligible offers through the nearby live feed/map, city-based feed, and search/filtering; results use distance bands rather than an exact distance.
- **SC-011**: In acceptance testing, an interested recipient can include a text message, the creator can see the approved profile and public trust information before selection, and an unselected interested recipient receives the expiry-without-selection outcome when applicable.
- **SC-012**: In acceptance testing, an eligible participant can submit a rating, written feedback, and a photo only through the approved consent/moderation flow; users can report public feedback and photos.
- **SC-013**: In acceptance testing, a non-subscribing user can publish three offers in the applicable calendar month, is prevented from publishing a fourth, and can see their remaining allowance before reaching the limit.
- **SC-014**: In acceptance testing, an active weekly, monthly, or yearly subscription permits an otherwise valid offer to be published without the free monthly allowance limit; when the subscription is inactive, the approved free allowance rule applies.
- **SC-015**: In acceptance testing, the three-offer allowance resets according to the calendar month defined by the user's registered-address city, and an eligible one-time purchase permits exactly one additional broadcast after the free allowance has been reached.
- **SC-016**: In acceptance testing, a user can cancel an automatically renewing subscription and retains unlimited-broadcast entitlement only through the approved end of the paid subscription period.
- **SC-017**: In acceptance testing, each configured country/location shows its applicable local-currency one-time and subscription prices, with the approved 10% monthly and 20% yearly discounts applied.
- **SC-018**: In acceptance testing, a supported device locale presents static/system UI content in that locale, a user-selected supported-language override persists for that user, and an unsupported device locale falls back to English; user-created content is never auto-translated.
- **SC-019**: In acceptance testing, the critical publish, discovery, interest, selection, and chat journeys are fully usable on the approved Android and iOS phone/tablet form factors AND in a supported desktop/laptop/Chromebook browser, with full feature parity between them, without any client directly accessing a service's data store.
- **SC-020**: In acceptance testing, any viewer who can see an active offer sees its current total expression-of-interest count without seeing the identity of any interested recipient; an unselected recipient on a partially-filled offer receives no explicit non-selection notice while the offer remains active or after it becomes inactive.

## Assumptions

- A user account exists before a person can create, receive, express interest in, be selected for, or chat about an offer; the authentication approach has not been chosen.
- The initial feature is intended for people looking for a spontaneous, in-person activity, not for a general-purpose event calendar or a long-lived public social feed.
- A city label can be associated with an offer place and with each registered city interest; the source and normalization rules are not yet chosen.
- “Prioritize” means rank relevant offers more prominently; it does not yet imply that non-current-city offers are suppressed.
- The supplied 15-minute default lifetime applies to an offer's availability for discovery and new expressions of interest. Whether it also limits notification display or an already-created chat is an open question.
- A profile may show a verification badge when photo and government-ID verification are completed. The badge's wording and whether either verification can be completed separately are open questions.
- Offer title, longer description, start time, language, accessibility needs, and capacity are not mandatory in the initial offer flow; they may be introduced after validation without changing the minimum publication requirement.
- “Google Maps or Apple Maps pin” expresses the desired map-pin experience, not an approved provider contract or implementation decision.
- The free monthly broadcast allowance applies only to users without an active eligible subscription; the calendar is determined by the registered-address city, while its time-zone mapping and countable broadcast state are open questions.
- The USD 1 one-time broadcast price is an initial business reference value; actual charged currency and prices are configurable by location/country.
- The examples describe possible activities and locations, not product endorsements or an approved safety policy for every type of activity.

## Open Questions

1. Signup age assurance is defined (see Clarifications: self-declared date of birth plus a mandatory photo liveness check, escalating to mandatory government-ID upload only if the photo check flags a possible minor); an incorrectly triggered escalation or rejected upload can be appealed manually, with the account restricted from publishing until resolved (see Clarifications, FR-016). Still open: ongoing/periodic re-verification, post-signup detection, reporting, enforcement actions, and which launch countries apply.
2. ~~Does the 15-minute default timer begin at publication...~~ Resolved (see Clarifications): the countdown starts at publish confirmation, and creators may configure a lifetime between 5 and 30 minutes.
3. The exact place is revealed only after creator selection, and is captured as a single snapshot at publish time with no further updates afterward — even for a moving/transient place. A `moving` place or a queue-style location without a fixed venue additionally requires a short free-text rendezvous instruction, disclosed only after selection along with the place itself (see Clarifications, FR-002). Resolved — no remaining open items.
4. Current location is sampled via device GPS every 60 seconds while the app is open, falling back to last known location (usable for up to 10 minutes before being treated as stale) when live GPS is unavailable (see Clarifications). Still open: the "nearby" radius/threshold, permission-denied behavior, and the user-visible explanation of this behavior.
5. A recipient must have both the city registered as an interest and be within a distance/radius of the offer, defaulting to 5 km and configurable per city (see Clarifications). Still open: whether availability, language, activity-preference, or an additional safety filter also applies.
6. Capacity is fixed at publish time (1–10), cannot be changed while the offer is active, and a selected recipient cannot be swapped for another (see Clarifications, FR-008). When the creator selects some but not all interested recipients, an unselected recipient receives no explicit non-selection notice; instead, the offer's total expression-of-interest count is publicly visible to any viewer while it is active (FR-042). (Selected recipients share one group chat with the creator — see Clarifications.) Resolved — no remaining open items.
7. Either party can cancel their participation after selection; the other party is notified via push and in-app message, a creator's revocation is treated the same as a cancellation, and the chat stays available read-only rather than being deleted (see Clarifications, FR-038). Resolved — no remaining open items.
8. Distance is shown as a confirmed band (<1 km, 1–5 km, 5–15 km, 15+ km), and an unverified user cannot hide the absent verification badge (see Clarifications, FR-014, FR-026). Still open: the location source/freshness used to compute the band, and other photo/profile visibility controls.
9. A block or report request is routed to moderation review before it takes effect broadly, but the submitting user's own view updates immediately so they stop seeing the blocked user; moderation review must complete within 4 hours of submission (see Clarifications, FR-015). Still open: the exact v1 behaviors for text/media chat, reporting review, emergency guidance, trusted-contact sharing, ratings/reviews, and data retention.
10. Prohibited/high-risk activities (paid meetings, private homes, dating/romantic framing) are screened via automated keyword/content screening at publish time only; v1 does not require human moderation review before publish, including for alcohol/age-restricted activities — the product owner has confirmed this automation-only approach applies to every offer (see Clarifications, FR-039). Still open: the screening rule set, its false-positive/negative handling, and appeal rules for a falsely blocked offer.
11. Push notification (targeting ~30-second delivery) plus the in-app live feed as a fallback are required; when push permission is denied or not granted, a persistent in-app banner/badge encourages the user to enable notifications, alongside the feed fallback (see Clarifications, FR-006). Still open: how the delivery-time target is measured/alerted on in production.
12. The primary v1 success metric is offer-to-interest conversion rate (see Clarifications, SC-008). Still open: baseline, target population, measurement period, and target value for that metric; secondary success/safety-health metrics and what should trigger a product or policy review.
13. The app selects the map provider automatically by platform default (Apple Maps on iOS, Google Maps on Android); no explicit creator choice is required (see Clarifications, FR-020). Still open: fallback behavior when the default provider is unavailable on a device, and whether moving/transient contexts such as a train or queue must also include typed guidance.
14. Push notifications are in scope for v1, and the v1 discovery feed filters are activity, distance band, and time remaining (see Clarifications, FR-006, FR-022). Still open: whether city, verification, rating, cost preference, language, or accessibility filters are also needed.
15. A meeting counts as completed (rating-eligible) unless either party cancelled beforehand, and the rating prompt is sent as an asynchronous follow-up exactly 2 hours after the selection resolves to "happened" (see Clarifications, FR-029). Still open: whether ratings must be mutual or can be one-way, what star scale is used, and when a rating becomes public.
16. A public feedback photo showing another identifiable person requires that person's explicit in-app consent before publication (see Clarifications, FR-029). Still open: the consent-capture flow and revocation, approval/removal rules, and how false or retaliatory ratings are handled.
17. The cost field uses selectable labels plus a moderated free-text note (see Clarifications, FR-028). Still open: the free-text character limit, moderation turnaround (pre- vs post-publish gating), supported currencies, and enforcement for violations.
18. The free-offer calendar month is determined by the user's registered-address city, and every successful publish counts toward it regardless of later outcome — a rebroadcast counts again (see Clarifications, FR-030). Still open: how that city is mapped to an authoritative time zone, what happens when the registered address changes, and how abuse or system failures affect the count.
19. Cancellation takes effect at the end of the current paid period, with no refund for the remaining period (see Clarifications, FR-032). Still open: what happens on a failed renewal, refund exceptions, subscription restoration, or a change between plans.
20. USD is the initial business reference, while charges are location/country-configured in local currency. What are the weekly, monthly, and yearly base prices, taxes, trials/promotions, payment channels, and launch-region rules? Must subscriptions be purchasable across all supported device platforms?
21. The monthly subscription has a 10% discount and the yearly subscription has a 20% discount. Relative to which undiscounted price are these discounts calculated, and do they stack with trials or other promotions?
22. Does a USD-1-equivalent one-time purchase provide one reusable future broadcast, or must it be used immediately for the offer currently being created? What refund policy applies if the offer is stopped, rejected by moderation, or cannot be published due to a technical failure?
23. Static/system UI text follows device locale with a user override and an English fallback (FR-040). Which languages are supported at launch, and does a selected language preference sync across a user's devices?
24. V1 targets Android and iOS phones/tablets AND a desktop/laptop/Chromebook browser, with full feature parity between them (FR-041, resolved — browser access ships in the same v1 release, not a fast-follow). Still open: which accessibility standard applies at launch, and the exact supported-browser/version matrix.
25. An active offer's total expression-of-interest count is publicly visible to any viewer as a non-identifying live indicator (FR-042). What refresh cadence applies — real-time push vs. a periodic interval consistent with FR-022's feed-refresh behavior?
