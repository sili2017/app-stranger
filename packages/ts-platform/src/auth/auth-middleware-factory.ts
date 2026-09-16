import { HttpStatus } from '@nestjs/common';
import { DomainError, buildErrorEnvelope } from '../errors/error-envelope';
import { OidcVerifier } from './oidc-verifier';
import { verifySessionToken } from './session-tokens';

let cachedVerifier: OidcVerifier | undefined;

function getVerifier(): OidcVerifier {
  if (!cachedVerifier) {
    const issuerUrl = process.env.OIDC_ISSUER_URL;
    if (!issuerUrl) {
      throw new Error('OIDC_ISSUER_URL must be set when AUTH_PROVIDER=oidc');
    }
    cachedVerifier = new OidcVerifier(issuerUrl, { audience: process.env.OIDC_AUDIENCE });
  }
  return cachedVerifier;
}

function respondUnauthenticated(req: any, res: any): void {
  const err = new DomainError('UNAUTHENTICATED', 'errors.unauthenticated', HttpStatus.UNAUTHORIZED);
  res.status(HttpStatus.UNAUTHORIZED).json(buildErrorEnvelope(err, req.correlationId ?? 'unknown'));
}

/**
 * Convergence T122 (ADQ-002a): replaces every service's own dev-principal.middleware.ts
 * (x-dev-user-id stand-in, duplicated 9x) with one shared factory. `AUTH_PROVIDER=oidc`
 * opts a service into real bearer-token verification against OIDC_ISSUER_URL (+
 * optional OIDC_AUDIENCE) via OidcVerifier; anything else (unset, by default) keeps
 * today's permissive dev behavior unchanged, so existing local/dev stacks and tests
 * keep working until a service is explicitly switched over.
 *
 * Item 30: a real `Authorization: Bearer <token>` is checked *first*, regardless of
 * `AUTH_PROVIDER` — this is our own session token (see session-tokens.ts), minted by
 * Identity & Profile once it verifies an email/password credential or a Google/
 * Facebook/Apple token. It's cryptographically verified here, not trusted blindly the
 * way `x-dev-user-id` is. A present-but-invalid Bearer token is a hard 401; a request
 * with no Bearer token at all falls through unchanged to the OIDC/dev-header behavior
 * below, so nothing already relying on `x-dev-user-id` (seed scripts, manual testing)
 * breaks.
 *
 * A plain Express middleware throw wouldn't reach Nest's DomainExceptionFilter (this
 * runs before Nest's request pipeline), so a verification failure is turned into a
 * 401 with the same DomainError-shaped body (see BearerAuthGuard, the gateway's
 * equivalent Nest-guard version of this check) directly here.
 *
 * Also carries over dev-principal.middleware.ts's `req.correlationId` assignment
 * (used by DomainExceptionFilter and every service's `correlation(req)` helper) —
 * unrelated to auth, but it lived in the same middleware and has no other home.
 *
 * `publicPaths` (ultrareview finding): a route a client is *meant* to call with no
 * credential at all — signup, login, or a third-party webhook (Stripe, say) that
 * authenticates itself its own way (a signature header) rather than a Bearer token —
 * must never hit the AUTH_PROVIDER=oidc "no Bearer -> 401" branch below, or it becomes
 * permanently uncallable the moment a service opts into real auth (the exact case a
 * new account has no token yet to register/log in *with*). Match on `req.path`
 * (Express strips the mount prefix already) against exact strings or `RegExp`s; only
 * skips the "no Bearer" 401 gate, never the Bearer-present verification above it — a
 * caller presenting a bad token still gets a hard 401 even on a public path.
 */
export function createAuthMiddleware(options: { publicPaths?: (string | RegExp)[] } = {}) {
  const publicPaths = options.publicPaths ?? [];
  const isPublicPath = (path: string) =>
    publicPaths.some((p) => (typeof p === 'string' ? p === path : p.test(path)));

  return async function authMiddleware(req: any, res: any, next: any): Promise<void> {
    req.correlationId = req.headers['x-correlation-id'] ?? 'dev-local';

    const bearer: string | undefined = req.headers['authorization'];
    if (bearer?.startsWith('Bearer ')) {
      const token = bearer.slice('Bearer '.length);
      try {
        req.verifiedPrincipal = await verifySessionToken(token);
        next();
        return;
      } catch {
        // Not one of our own session tokens — if this service is opted into a real
        // external OIDC vendor (AUTH_PROVIDER=oidc, still-open ADQ-002a), give that
        // verifier a chance before failing outright, so the two paths coexist.
        if (process.env.AUTH_PROVIDER === 'oidc') {
          try {
            req.verifiedPrincipal = await getVerifier().verify(token);
            next();
            return;
          } catch {
            respondUnauthenticated(req, res);
            return;
          }
        }
        respondUnauthenticated(req, res);
        return;
      }
    }

    if (process.env.AUTH_PROVIDER === 'oidc' && !isPublicPath(req.path)) {
      respondUnauthenticated(req, res);
      return;
    }

    const devUserId = req.headers['x-dev-user-id'];
    if (devUserId) {
      req.verifiedPrincipal = {
        userId: String(devUserId),
        ageAssuranceStatus: 'liveness_passed',
        roles: [],
      };
    }
    next();
  };
}
