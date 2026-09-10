# Stranger Constitution

## Core Principles

### I. Real-World Connection with Informed Consent
Stranger exists to help people voluntarily arrange a short, real-world activity with another person. No person may be exposed to, contacted about, or connected to an offer without an intentional product action appropriate to their preferences. The product must not imply identity, background, safety, or suitability that it cannot substantiate.

### II. Safety, Privacy, and Respect Are Product Requirements
Location, identity, messaging, content, consent, and abuse prevention are first-class product concerns. A feature specification is incomplete until it states the required safety and privacy behavior, or explicitly records the decision as needing clarification. The product must not proceed to external release with unresolved material safety, age, location-sharing, blocking/reporting, or data-retention decisions.

### III. Time-Bound Offers Are Honest and Unambiguous
An offer is a time-bound invitation, not a durable social post. The v1 default lifetime is 15 minutes; creators may configure the lifetime within product-approved limits. Users must be able to understand when an offer is active, stopped, expired, rebroadcast, or can no longer be accepted. Any change to the default lifetime or the meaning of expiry requires an approved specification amendment.

### IV. Location Relevance Without Unnecessary Exposure
Current location and registered city interests are used to make offers more relevant. The product collects, displays, and retains no more location information than an approved user journey requires. Relevance rules must be explainable to the user and must distinguish known requirements from unresolved matching-policy choices.

### V. Specifications Before Implementation
Product behavior is defined in a feature specification before technical planning or implementation. Specifications focus on user outcomes, business rules, edge cases, measurable success criteria, assumptions, and open questions; they do not prescribe a technology stack. Ambiguity is recorded as `NEEDS CLARIFICATION`, never converted into an unstated implementation decision.

### VI. Trust Signals Must Be Fair, Consented, and Reviewable
Verification, ratings, written feedback, and photos can help people make safer choices, but must not become unreviewable reputation harm. Public trust signals require an approved consent, moderation, reporting, removal, and appeal policy. The product must not expose private safety reports to other users as profile information.

## Product Constraints and Boundaries

- The initial product scope is a social app for creating an activity offer at a specific place, expressing interest, creator selection, and coordination by chat.
- Examples of activities (tea, coffee, study break, beer, dinner, boat trip, and table tennis) illustrate a generic activity model; they do not define a closed catalog.
- An offer has a 15-minute default lifetime and may be configured by its creator; approved lower/upper limits and the timer start point are recorded in the first feature specification.
- The intended initial audience is registered adults aged 18 or older. The app must not be used by minors or enable offers involving minors.
- Account creation includes a profile-verification process for photo and government ID, but an incomplete verification does not block use. A completed verification is reflected in a user's profile and may be promoted by the product.
- A non-subscribing user may broadcast no more than three offers per calendar month, determined by the city recorded in their registered address. After the free allowance, users may publish an additional single offer for a configurable local-currency equivalent of USD 1 or use an automatically renewing weekly, monthly, or yearly subscription with cancellation available. Active subscriptions grant unlimited offer publishing. Monthly subscriptions receive a 10% configured discount and yearly subscriptions receive a 20% configured discount; subscription base prices, discount reference prices, tax, and purchase rules require an approved monetization specification.
- Technology, platforms, login method, business model, geography, languages, moderation implementation, and notification delivery channel are not decided by this constitution.

## Product Workflow and Quality Gates

1. Capture one independently valuable product capability in `spec.md` using `/speckit-specify`.
2. Use `/speckit-clarify` to resolve high-impact ambiguity; retain unresolved items in the specification rather than inventing answers.
3. Review requirements quality with `/speckit-checklist` and obtain product-owner approval before `/speckit-plan`.
4. Use `/speckit-plan` only for the approved technical approach, then `/speckit-tasks` for implementation work and `/speckit-implement` for execution.
5. Keep traceability from each implementation task to an approved functional requirement and acceptance scenario.

## Governance

This constitution governs all Stranger specifications and later plans. A feature may add detail but may not override these principles without an explicit, versioned amendment approved by the product owner. Requirement-review checklists are product-quality gates: a checked item means the requirement quality was reviewed and satisfied, not that software has been implemented. Claude integration instructions and feature specifications must be read before planning or coding.

**Version**: 0.1.0 | **Ratified**: 2026-09-10 | **Last Amended**: 2026-09-10
