import * as jose from 'jose';

/**
 * [BLOCKED: ADQ-002a] Local dev-only OIDC-compatible token issuer/verifier substituting
 * for the approved auth provider (research.md §9). A real managed or self-hosted OIDC
 * issuer is a drop-in replacement for this class — every consumer depends only on
 * `verify()`'s VerifiedPrincipal-shaped return, never on this dev implementation.
 *
 * MUST NOT be used in production: the signing key is generated in-process and lost on
 * restart, and there is no real login/credential flow behind it.
 */
export class DevOidcIssuer {
  private readonly secret = new TextEncoder().encode(
    process.env.DEV_OIDC_SECRET ?? 'dev-only-not-for-production',
  );

  async issueDevToken(userId: string, ageAssuranceStatus: string, roles: string[] = []) {
    return new jose.SignJWT({ ageAssuranceStatus, roles })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(this.secret);
  }

  async verify(bearerToken: string): Promise<{
    userId: string;
    ageAssuranceStatus: string;
    roles: string[];
  }> {
    const { payload } = await jose.jwtVerify(bearerToken, this.secret);
    return {
      userId: String(payload.sub),
      ageAssuranceStatus: String(payload.ageAssuranceStatus ?? 'self_declared'),
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
    };
  }
}
