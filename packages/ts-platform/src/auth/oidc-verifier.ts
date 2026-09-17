import * as jose from 'jose';
import { VerifiedPrincipal } from './verified-principal';

export interface OidcVerifierOptions {
  audience?: string;
  jwksUri?: string;
  // The key-getter type both `jose.createRemoteJWKSet` and `jose.createLocalJWKSet`
  // return — inject a local one in tests so verification never needs a real network
  // fetch.
  jwks?: jose.JWTVerifyGetKey;
}

/**
 * Convergence T122 (ADQ-002a): generic JWT/JWKS verifier for any standard OIDC
 * provider (the specific vendor — Auth0/Clerk/Cognito/self-hosted — is still an open,
 * low-impact pick, see ADR-007/ADQ-002a) — deliberately not built against a vendor SDK.
 * `verify()` returns a VerifiedPrincipal, the same contract DevOidcIssuer.verify()
 * already honors, so this is a drop-in replacement wherever that contract is consumed.
 *
 * Different providers namespace custom claims differently (e.g. Auth0's
 * `https://myapp.com/roles`); this verifier deliberately does not hardcode any one
 * vendor's convention and instead reads `ageAssuranceStatus`/`roles` as top-level
 * claims — the deploying provider must be configured to emit them that way.
 */
export class OidcVerifier {
  private readonly audience?: string;
  private readonly jwksUri: string;
  private readonly jwks: jose.JWTVerifyGetKey;

  constructor(
    private readonly issuerUrl: string,
    options: OidcVerifierOptions = {},
  ) {
    this.audience = options.audience;
    this.jwksUri = options.jwksUri ?? `${issuerUrl.replace(/\/$/, '')}/.well-known/jwks.json`;
    this.jwks = options.jwks ?? jose.createRemoteJWKSet(new URL(this.jwksUri));
  }

  // Lets jose.jwtVerify throw naturally (bad signature, expired, wrong issuer/audience)
  // — the caller (createAuthMiddleware) decides how to turn that into a response.
  async verify(bearerToken: string): Promise<VerifiedPrincipal> {
    const { payload } = await jose.jwtVerify(bearerToken, this.jwks, {
      issuer: this.issuerUrl,
      audience: this.audience,
    });
    return {
      userId: String(payload.sub),
      ageAssuranceStatus:
        typeof payload.ageAssuranceStatus === 'string'
          ? payload.ageAssuranceStatus
          : 'self_declared',
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
    };
  }
}
