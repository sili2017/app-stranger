import { HttpStatus } from '@nestjs/common';
import { DomainError, buildErrorEnvelope } from '../errors/error-envelope';
import { OidcVerifier } from './oidc-verifier';

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
 * A plain Express middleware throw wouldn't reach Nest's DomainExceptionFilter (this
 * runs before Nest's request pipeline), so a verification failure is turned into a
 * 401 with the same DomainError-shaped body (see BearerAuthGuard, the gateway's
 * equivalent Nest-guard version of this check) directly here.
 *
 * Also carries over dev-principal.middleware.ts's `req.correlationId` assignment
 * (used by DomainExceptionFilter and every service's `correlation(req)` helper) —
 * unrelated to auth, but it lived in the same middleware and has no other home.
 */
export function createAuthMiddleware() {
  return async function authMiddleware(req: any, res: any, next: any): Promise<void> {
    req.correlationId = req.headers['x-correlation-id'] ?? 'dev-local';

    if (process.env.AUTH_PROVIDER === 'oidc') {
      const header: string | undefined = req.headers['authorization'];
      if (!header?.startsWith('Bearer ')) {
        respondUnauthenticated(req, res);
        return;
      }
      const token = header.slice('Bearer '.length);
      try {
        req.verifiedPrincipal = await getVerifier().verify(token);
        next();
      } catch {
        respondUnauthenticated(req, res);
      }
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
