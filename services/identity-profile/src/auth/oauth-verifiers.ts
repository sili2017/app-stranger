import * as jose from 'jose';
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';

export interface OAuthIdentity {
  subject: string;
  email?: string;
  firstName?: string;
}

const FETCH_TIMEOUT_MS = 8_000;

const googleJwks = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function notConfigured(provider: string): never {
  throw new DomainError(
    'PROVIDER_NOT_CONFIGURED',
    'errors.providerNotConfigured',
    HttpStatus.SERVICE_UNAVAILABLE,
    [{ field: 'provider', issue: provider }],
  );
}

function invalidToken(): never {
  throw new DomainError('INVALID_OAUTH_TOKEN', 'errors.invalidOauthToken', HttpStatus.UNAUTHORIZED);
}

/**
 * Item 30.1.1: verifies a Google ID token (from google_sign_in's web flow) against
 * Google's own JWKS — never trusts the client's claim of who signed in. Needs only
 * GOOGLE_WEB_CLIENT_ID (the OAuth Web Client ID from Google Cloud Console); no secret
 * is required to verify an ID token's signature.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<OAuthIdentity> {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!clientId) notConfigured('google');
  try {
    const { payload } = await jose.jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    return {
      subject: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      firstName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
    };
  } catch {
    invalidToken();
  }
}

/**
 * Item 30.1.2: verifies an Apple identity token (Sign in with Apple) against Apple's
 * own JWKS. Needs APPLE_SERVICE_ID (the Services ID registered with Apple, used as
 * this token's audience). Getting a real token to verify at all additionally requires
 * a stable, Apple-registered domain hosting Apple's domain-association file — a
 * rotating dev tunnel URL can't satisfy that, so this is real but untestable
 * end-to-end until a permanent domain is in place.
 */
export async function verifyAppleIdToken(idToken: string): Promise<OAuthIdentity> {
  const serviceId = process.env.APPLE_SERVICE_ID;
  if (!serviceId) notConfigured('apple');
  try {
    const { payload } = await jose.jwtVerify(idToken, appleJwks, {
      issuer: 'https://appleid.apple.com',
      audience: serviceId,
    });
    return {
      subject: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      // Apple never includes a name claim in the identity token itself — the client
      // only ever receives it once, out-of-band, at the very first authorization.
      // OAuthLoginDto.firstName carries it through for a brand-new account.
    };
  } catch {
    invalidToken();
  }
}

/**
 * Item 30.1.1: verifies a Facebook access token by asking Facebook's own Graph API who
 * it belongs to (debug_token) — a forged/stolen token fails this call outright rather
 * than being trusted at face value. Needs FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.
 */
export async function verifyFacebookAccessToken(accessToken: string): Promise<OAuthIdentity> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) notConfigured('facebook');

  const appToken = `${appId}|${appSecret}`;
  const debugUrl =
    `https://graph.facebook.com/debug_token` +
    `?input_token=${encodeURIComponent(accessToken)}` +
    `&access_token=${encodeURIComponent(appToken)}`;
  const debugRes = await fetch(debugUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const debugBody = (await debugRes.json().catch(() => null)) as {
    data?: { is_valid?: boolean; app_id?: string };
  } | null;
  if (!debugRes.ok || !debugBody?.data?.is_valid || debugBody.data.app_id !== appId) {
    invalidToken();
  }

  const meUrl = `https://graph.facebook.com/me?fields=id,email,first_name&access_token=${encodeURIComponent(accessToken)}`;
  const meRes = await fetch(meUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const me = (await meRes.json().catch(() => null)) as {
    id?: string;
    email?: string;
    first_name?: string;
  } | null;
  if (!meRes.ok || !me?.id) {
    invalidToken();
  }
  return { subject: me.id, email: me.email, firstName: me.first_name };
}
