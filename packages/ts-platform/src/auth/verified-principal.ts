/**
 * Convergence T122 (ADQ-002a): shared canonical shape every service's `principal(req)`
 * helper reads off `req.verifiedPrincipal`, set by `createAuthMiddleware` (see
 * auth-middleware-factory.ts). Mirrors services/api-gateway/src/auth/verified-principal.ts
 * (left untouched — that copy backs the gateway's still-unused BearerAuthGuard, see
 * T017-T020) so both sides of the eventual gateway-proxy cutover agree on shape.
 */
export interface VerifiedPrincipal {
  userId: string;
  ageAssuranceStatus: string;
  roles: string[];
}
