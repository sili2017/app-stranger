# Stranger Constitution

## 1. Role and Decision Discipline

The delivery team acts as Product Manager, Business Analyst, Solution Architect, UX Engineer, Mobile Engineer, Backend Engineer, AI Engineer, Database Engineer, QA Engineer, Security Engineer, and DevOps Engineer. A request that conflicts with approved requirements, architecture, security rules, acceptance criteria, or data integrity must be explained and resolved before implementation.

## 2. Requirements Before Implementation

No feature is implemented solely from a conversational request. Every change must trace from an approved requirement to a user story, acceptance criteria, design, implementation, and tests. Missing requirements are recorded with impact and alternatives; they require product-owner approval before the decision is treated as final.

## 3. Product Principles

### I. Real-World Connection with Informed Consent
Stranger helps adults voluntarily arrange a real-world activity. The product must not imply identity, background, safety, or suitability that it cannot substantiate. No person may be contacted or connected without the intentional product actions appropriate to their preferences.

### II. Safety, Privacy, and Respect Are Product Requirements
Location, identity, messaging, content, consent, and abuse prevention are first-class product concerns. The product must not proceed to external release with unresolved material safety, adult-only eligibility, location-sharing, blocking/reporting, or data-retention decisions.

### III. Time-Bound Offers Are Honest and Unambiguous
An offer is a time-bound invitation, not a durable social post. The v1 default lifetime is 15 minutes; creators may configure it within product-approved limits. The product must make active, stopped, expired, and rebroadcast states clear.

### IV. Location Relevance Without Unnecessary Exposure
Registered city interests and current location improve relevance, but the product collects, displays, and retains no more location information than an approved journey requires. Ranking must be explainable and must not reveal precise location where a distance band or later disclosure is sufficient.

### V. Trust Signals Must Be Fair, Consented, and Reviewable
Verification, ratings, written feedback, and photos can help people make safer choices, but must not become unreviewable reputation harm. Public trust signals require approved consent, moderation, reporting, removal, and appeal policy. Private safety reports must never appear as public profile information.

## 4. Technology and Client Platforms

| Area | Standard |
| --- | --- |
| Mobile and client UI | Flutter / Dart for Android and iOS phones/tablets; responsive Flutter Web and/or Flutter desktop distribution for browser and computer use, subject to product release scope |
| Edge/API services | Node.js / TypeScript |
| AI services | Python, only for approved AI use cases such as moderation or translation; no AI behavior is assumed by this constitution |
| Primary data store | PostgreSQL, with isolated ownership per microservice |
| Cache and ephemeral coordination | Redis |
| Containers | Docker |
| CI/CD | GitHub Actions |
| Source control | GitHub |
| Monitoring | Sentry, supplemented by structured logs, metrics, and traces |

The backend is frontend-neutral: versioned REST contracts are the public interface for mobile, tablet, web, and desktop clients. A client must not access a service database directly or contain domain rules that belong in a backend service.

## 5. Architecture Principles

- Use a layered, domain-aligned microservice architecture: client experience layer, API/edge layer, domain-services layer, and platform/integration layer.
- Use clean architecture, SOLID principles, strong typing, dependency injection, and domain-driven design where it improves a bounded context.
- Prefer REST for public and synchronous service contracts. A different protocol needs explicit justification.
- Each microservice owns its domain logic, API contract, and data. Cross-service changes use explicit contracts and domain events; no service reads another service's private tables.
- Use transactional outbox and idempotent consumers for cross-service domain events. The production event-bus technology must be approved before implementation.
- Avoid duplicated business logic, giant classes/functions, hidden global state, business logic in UI widgets, direct database access from UI, hardcoded credentials, and unapproved shared databases.
- Localize the client according to device locale with an accessible language override and fallback. Backend-generated system messages use the user's saved preference. Translation of user-created content is not assumed without a separate approved requirement.

## 6. Requirements, Documentation, and Traceability

`docs/product/` and `docs/requirements/` are the approved product-documentation entry points. The Spec Kit feature artifact at `specs/<feature>/spec.md` is the formal, versioned feature specification used by planning and implementation. To prevent two competing truths, a change to an approved requirement must update the relevant documents and Spec Kit specification in the same review; if there is a discrepancy, implementation stops until the product owner resolves it.

The current approved feature baseline is `specs/spec.md` ("Ephemeral Stranger Meet Offers", feature branch `001-stranger-meet-offers`). Its requirements and open questions govern the initial architecture plan.

### Spec Kit Workflow

1. Capture one independently valuable product capability in `spec.md` using `/speckit-specify`.
2. Use `/speckit-clarify` to resolve high-impact ambiguity; retain unresolved items in the specification rather than inventing answers.
3. Review requirements quality with `/speckit-checklist` and obtain product-owner approval before `/speckit-plan`.
4. Use `/speckit-plan` only for the approved technical approach, then `/speckit-tasks` for implementation work and `/speckit-implement` for execution.
5. Keep traceability from each implementation task to an approved functional requirement and acceptance scenario.

## 7. API, Security, and Database Rules

Every public API endpoint must specify request/response schemas, authentication, authorization, validation, standard errors, rate limits, and logging/audit requirements. Public contracts are versioned and documented before client implementation.

Never commit, log, or expose secrets, private keys, passwords, API keys, signing certificates, or production credentials. Secrets come from environment-specific secret stores or GitHub environment secrets. Authentication must not be disabled for convenience.

All schema changes use reviewed, tested, documented migrations. Migrations are reversible where practical; production schemas are never manually changed. Sensitive identity, government-ID, location, chat, payment, and moderation data use least privilege, encryption in transit, encryption at rest where supported, retention rules, and access auditing.

## 8. Quality, Git, and Delivery

Before changing code: inspect the implementation, dependencies, affected requirements, design, and tests; then make the smallest safe plan. After changing code: format, lint, type-check, run unit tests, run relevant integration tests, update documentation, and run E2E tests for critical journeys.

No feature is complete merely because code exists. Completion requires approved requirements and acceptance criteria, passing automated tests, lint/type checks, relevant security checks, documentation updates, and pull-request review.

Never commit directly to `main`. Use `feature/*`, `bugfix/*`, `hotfix/*`, `refactor/*`, or `chore/*` branches and `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, or `security:` commits. Each pull request documents purpose, requirements, changed files, tests, security implications, database changes, breaking changes, and deployment implications.

## 9. Human Approval Required

Claude and other agents must not autonomously publish production releases, rotate credentials, delete production data, destructively modify production infrastructure, change billing, submit legal declarations, or accept App Store or Google Play agreements. Human approval is required.

## Governance

This constitution governs all Stranger specifications and later plans, and supersedes conflicting development practices. A feature may add detail but may not override these principles without an explicit, versioned amendment approved by the product owner. In a conflict, decide in this order: security; data integrity; explicit approved requirements; architecture; tests; performance; developer convenience. Amendments require product-owner approval, a version update, and an assessment of affected specifications, services, APIs, and data migrations.

Requirement-review checklists are product-quality gates: a checked item means the requirement quality was reviewed and satisfied, not that software has been implemented. Claude and other agents must read the applicable feature specification (and any Claude-specific integration instructions) before planning or coding against it.

**Version**: 0.3.0 | **Ratified**: 2026-09-10 | **Last Amended**: 2026-09-10
