import * as jose from 'jose';
import { VerifiedPrincipal } from './verified-principal';

/**
 * Item 30: real session tokens backing email/password and OAuth (Google/Facebook/
 * Apple) login. HS256 with a secret shared across every service via AUTH_JWT_SECRET
 * (falls back to a fixed dev value so a fresh local checkout keeps working without
 * extra setup — override it before anything resembling production). Identity &
 * Profile is the only service that ever verifies a *credential* (a password hash, or a
 * Google/Apple/Facebook token); once it does, it mints one of these, and every other
 * service verifies it via createAuthMiddleware without knowing anything about how the
 * credential was originally proven.
 */
const secret = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? 'dev-only-shared-secret-change-me',
);

// Item 30.2: "kept logged into the device till they logout themselves" — no
// expiry-driven forced logout, just a long-dated token the client holds onto and
// discards on an explicit logout.
const SESSION_TOKEN_TTL = '180d';

export async function signSessionToken(principal: VerifiedPrincipal): Promise<string> {
  return new jose.SignJWT({
    ageAssuranceStatus: principal.ageAssuranceStatus,
    roles: principal.roles,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(principal.userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TOKEN_TTL)
    .sign(secret);
}

// Lets jose.jwtVerify throw naturally (bad signature, expired) — the caller
// (createAuthMiddleware) decides how to turn that into a response.
export async function verifySessionToken(token: string): Promise<VerifiedPrincipal> {
  const { payload } = await jose.jwtVerify(token, secret);
  return {
    userId: String(payload.sub),
    ageAssuranceStatus:
      typeof payload.ageAssuranceStatus === 'string' ? payload.ageAssuranceStatus : 'self_declared',
    roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
  };
}
