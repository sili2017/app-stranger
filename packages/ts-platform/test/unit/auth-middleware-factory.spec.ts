function fakeReqRes(headers: Record<string, string> = {}) {
  const req: any = { headers };
  const res: any = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return { req, res };
}

describe('createAuthMiddleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.dontMock('../../src/auth/oidc-verifier');
  });

  it('AUTH_PROVIDER unset: reads x-dev-user-id and always calls next()', async () => {
    delete process.env.AUTH_PROVIDER;
    const { createAuthMiddleware } = require('../../src/auth/auth-middleware-factory');
    const middleware = createAuthMiddleware();
    const { req, res } = fakeReqRes({ 'x-dev-user-id': 'dev-user-1' });
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.verifiedPrincipal).toEqual({
      userId: 'dev-user-1',
      ageAssuranceStatus: 'liveness_passed',
      roles: [],
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });

  it('AUTH_PROVIDER unset and no x-dev-user-id header: still calls next() (permissive dev behavior)', async () => {
    delete process.env.AUTH_PROVIDER;
    const { createAuthMiddleware } = require('../../src/auth/auth-middleware-factory');
    const middleware = createAuthMiddleware();
    const { req, res } = fakeReqRes({});
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.verifiedPrincipal).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('AUTH_PROVIDER=oidc with missing Authorization header: responds 401 and never calls next()', async () => {
    process.env.AUTH_PROVIDER = 'oidc';
    const { createAuthMiddleware } = require('../../src/auth/auth-middleware-factory');
    const middleware = createAuthMiddleware();
    const { req, res } = fakeReqRes({});
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('AUTH_PROVIDER=oidc with malformed (non-Bearer) Authorization header: responds 401 and never calls next()', async () => {
    process.env.AUTH_PROVIDER = 'oidc';
    const { createAuthMiddleware } = require('../../src/auth/auth-middleware-factory');
    const middleware = createAuthMiddleware();
    const { req, res } = fakeReqRes({ authorization: 'Basic not-a-bearer-token' });
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('AUTH_PROVIDER=oidc with a well-formed header but a verifier that rejects: responds 401', async () => {
    process.env.AUTH_PROVIDER = 'oidc';
    process.env.OIDC_ISSUER_URL = 'https://issuer.example.test/';
    jest.doMock('../../src/auth/oidc-verifier', () => ({
      OidcVerifier: jest.fn().mockImplementation(() => ({
        verify: jest.fn().mockRejectedValue(new Error('bad signature')),
      })),
    }));
    const { createAuthMiddleware } = require('../../src/auth/auth-middleware-factory');
    const middleware = createAuthMiddleware();
    const { req, res } = fakeReqRes({ authorization: 'Bearer some.invalid.token' });
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('AUTH_PROVIDER=oidc with a well-formed header and a verifier that succeeds: sets verifiedPrincipal and calls next()', async () => {
    process.env.AUTH_PROVIDER = 'oidc';
    process.env.OIDC_ISSUER_URL = 'https://issuer.example.test/';
    const principal = { userId: 'u-1', ageAssuranceStatus: 'liveness_passed', roles: ['member'] };
    jest.doMock('../../src/auth/oidc-verifier', () => ({
      OidcVerifier: jest.fn().mockImplementation(() => ({
        verify: jest.fn().mockResolvedValue(principal),
      })),
    }));
    const { createAuthMiddleware } = require('../../src/auth/auth-middleware-factory');
    const middleware = createAuthMiddleware();
    const { req, res } = fakeReqRes({ authorization: 'Bearer some.valid.token' });
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.verifiedPrincipal).toEqual(principal);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });
});
