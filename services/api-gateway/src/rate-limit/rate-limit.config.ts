/**
 * Per-endpoint rate-limit configuration surface (contracts/api-standards.md §Rate
 * Limits: "No endpoint ships without a stated limit — a limit of 'none' must be an
 * explicit, reviewed exception, not an omission"). This map documents the limit each
 * domain service enforces on its own controllers via `@Throttle()` (T112) — the gateway
 * does not yet proxy requests to domain services (only scaffolded per T017-T020), so
 * this is the source-of-truth ledger for cross-service consistency, not (yet) a second
 * enforcement point.
 *
 * All values below are provisional defaults sized for a v1 launch, not the product of
 * an approved abuse-threshold policy (plan.md Security and Privacy Architecture) —
 * flagged per-row where a specific NEEDS CLARIFICATION exists in a contract file.
 */
export interface RateLimitRule {
  ttlSeconds: number;
  limit: number;
  /** true only for a reviewed, explicit no-limit exception — never a silent omission. */
  explicitlyUnlimited?: boolean;
}

export const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  // Identity & Profile
  'POST /api/v1/verification/signup-age-assurance': { ttlSeconds: 60, limit: 5 },
  'POST /api/v1/verification/government-id': { ttlSeconds: 60, limit: 5 },
  'POST /api/v1/verification/appeals': { ttlSeconds: 60, limit: 5 },
  'GET /api/v1/city-interests': { ttlSeconds: 60, limit: 60 },
  'POST /api/v1/city-interests': { ttlSeconds: 60, limit: 20 },
  'DELETE /api/v1/city-interests/{cityId}': { ttlSeconds: 60, limit: 20 },

  // Offer
  'POST /api/v1/offers': {
    ttlSeconds: 60,
    // NEEDS CLARIFICATION (contracts/public/offer-service.md): exact threshold pending
    // abuse-threshold policy. Provisional value only.
    limit: 5,
  },
  'POST /api/v1/offers/{id}/stop': { ttlSeconds: 60, limit: 20 },
  'GET /api/v1/offers/{id}': { ttlSeconds: 60, limit: 120 },
  'GET /api/v1/offers': { ttlSeconds: 60, limit: 60 },
  'GET /api/v1/offers/{id}/rebroadcast': { ttlSeconds: 60, limit: 20 },
  'GET /api/v1/offers/{id}/place': { ttlSeconds: 60, limit: 60 },
  'POST /api/v1/offers/{id}/rebroadcast': { ttlSeconds: 60, limit: 10 },

  // Discovery & Location
  'PUT /api/v1/me/location': { ttlSeconds: 60, limit: 60 },
  'GET /api/v1/discovery/feed': { ttlSeconds: 60, limit: 30 },

  // Participation
  'POST /api/v1/offers/{id}/expressions-of-interest': { ttlSeconds: 60, limit: 20 },
  'GET /api/v1/offers/{id}/expressions-of-interest': { ttlSeconds: 60, limit: 60 },
  'GET /api/v1/offers/{id}/selections/mine': { ttlSeconds: 60, limit: 60 },
  'POST /api/v1/offers/{id}/selections': { ttlSeconds: 60, limit: 30 },
  'POST /api/v1/offers/{id}/selections/{selectionId}/cancel': { ttlSeconds: 60, limit: 20 },

  // Messaging
  'GET /api/v1/conversations': { ttlSeconds: 60, limit: 60 },
  'GET /api/v1/conversations/{id}/messages': { ttlSeconds: 60, limit: 60 },
  'POST /api/v1/conversations/{id}/messages': { ttlSeconds: 60, limit: 60 },

  // Trust & Safety
  'POST /api/v1/ratings': { ttlSeconds: 60, limit: 20 },
  'POST /api/v1/ratings/{id}/photo-consent': { ttlSeconds: 60, limit: 20 },
  'POST /api/v1/blocks': { ttlSeconds: 60, limit: 20 },
  'GET /api/v1/blocks': { ttlSeconds: 60, limit: 60 },
  'POST /api/v1/reports': { ttlSeconds: 60, limit: 20 },
  'GET /api/v1/trusted-contacts': { ttlSeconds: 60, limit: 60 },
  'PUT /api/v1/trusted-contacts': { ttlSeconds: 60, limit: 20 },

  // Entitlements & Billing
  'GET /api/v1/entitlements': { ttlSeconds: 60, limit: 60 },
  'POST /api/v1/subscriptions': { ttlSeconds: 60, limit: 10 },
  'POST /api/v1/subscriptions/{id}/cancel': { ttlSeconds: 60, limit: 10 },
  'POST /api/v1/broadcast-purchases': { ttlSeconds: 60, limit: 10 },
};
