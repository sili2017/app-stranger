import * as jose from 'jose';
import { OidcVerifier } from '../../src/auth/oidc-verifier';

const ISSUER = 'https://issuer.example.test/';
const AUDIENCE = 'stranger-api';

describe('OidcVerifier', () => {
  let publicJwk: jose.JWK;
  let privateKey: jose.KeyLike;
  let kid: string;

  beforeAll(async () => {
    const { publicKey, privateKey: sk } = await jose.generateKeyPair('RS256');
    privateKey = sk;
    kid = 'test-key-1';
    publicJwk = { ...(await jose.exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  });

  function makeVerifier(options?: { audience?: string }) {
    const jwks = jose.createLocalJWKSet({ keys: [publicJwk] });
    return new OidcVerifier(ISSUER, { audience: options?.audience ?? AUDIENCE, jwks });
  }

  async function signToken(overrides: Record<string, unknown> = {}, expiresIn = '1h') {
    return new jose.SignJWT({
      ageAssuranceStatus: 'liveness_passed',
      roles: ['member'],
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject('user-123')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  }

  it('verifies a validly-signed token and returns the matching VerifiedPrincipal', async () => {
    const verifier = makeVerifier();
    const token = await signToken();

    const principal = await verifier.verify(token);

    expect(principal).toEqual({
      userId: 'user-123',
      ageAssuranceStatus: 'liveness_passed',
      roles: ['member'],
    });
  });

  it('falls back to documented defaults when custom claims are absent', async () => {
    const verifier = makeVerifier();
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject('user-456')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const principal = await verifier.verify(token);

    expect(principal).toEqual({
      userId: 'user-456',
      ageAssuranceStatus: 'self_declared',
      roles: [],
    });
  });

  it('throws on an expired token', async () => {
    const verifier = makeVerifier();
    const token = await signToken({}, '-1s');

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('throws on a token from the wrong issuer', async () => {
    const verifier = makeVerifier();
    const token = await new jose.SignJWT({ ageAssuranceStatus: 'liveness_passed', roles: [] })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject('user-123')
      .setIssuer('https://not-the-configured-issuer.example.test/')
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('defaults jwksUri from the issuer URL when not given', () => {
    const jwks = jose.createLocalJWKSet({ keys: [publicJwk] });
    const verifier = new OidcVerifier('https://issuer.example.test', { jwks }) as any;
    expect(verifier.jwksUri).toBe('https://issuer.example.test/.well-known/jwks.json');
  });
});
