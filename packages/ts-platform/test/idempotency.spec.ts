import Redis from 'ioredis';
import { of, throwError, firstValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from '../src/idempotency/idempotency.interceptor';
import { DomainError } from '../src/errors/error-envelope';

function fakeContext(method: string, path: string, headers: Record<string, string>, body: unknown) {
  const response = {
    statusCode: 201,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  const request = { method, path, headers, body };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
}

describe('IdempotencyInterceptor', () => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
  const interceptor = new IdempotencyInterceptor(redis);

  afterAll(async () => {
    await redis.quit();
  });

  it('passes through requests without an Idempotency-Key header', async () => {
    let handlerCalls = 0;
    const ctx = fakeContext('POST', '/offers', {}, { a: 1 });
    const next = {
      handle: () => {
        handlerCalls += 1;
        return of({ ok: true });
      },
    };
    const result = await firstValueFrom(await interceptor.intercept(ctx, next));
    expect(result).toEqual({ ok: true });
    expect(handlerCalls).toBe(1);
  });

  it('passes through non-POST requests even with a key present', async () => {
    let handlerCalls = 0;
    const ctx = fakeContext('GET', '/offers', { 'idempotency-key': 'k-get' }, undefined);
    const next = {
      handle: () => {
        handlerCalls += 1;
        return of({ ok: true });
      },
    };
    await firstValueFrom(await interceptor.intercept(ctx, next));
    expect(handlerCalls).toBe(1);
  });

  it('replays the cached result for a same-key, same-body retry without re-invoking the handler', async () => {
    const key = `k-replay-${Date.now()}`;
    let handlerCalls = 0;
    const body = { activityText: 'tea' };
    const makeCtx = () => fakeContext('POST', '/offers', { 'idempotency-key': key }, body);
    const next = {
      handle: () => {
        handlerCalls += 1;
        return of({ id: 'created-once' });
      },
    };

    const first = await firstValueFrom(await interceptor.intercept(makeCtx(), next));
    expect(first).toEqual({ id: 'created-once' });

    const second = await firstValueFrom(await interceptor.intercept(makeCtx(), next));
    expect(second).toEqual({ id: 'created-once' });
    expect(handlerCalls).toBe(1);
  });

  it('rejects a same-key retry whose body differs with IDEMPOTENCY_KEY_CONFLICT', async () => {
    const key = `k-conflict-${Date.now()}`;
    const next = { handle: () => of({ id: 'x' }) };
    await firstValueFrom(
      await interceptor.intercept(
        fakeContext('POST', '/offers', { 'idempotency-key': key }, { a: 1 }),
        next,
      ),
    );

    await expect(
      interceptor.intercept(
        fakeContext('POST', '/offers', { 'idempotency-key': key }, { a: 2 }),
        next,
      ),
    ).rejects.toMatchObject(
      new DomainError('IDEMPOTENCY_KEY_CONFLICT', 'errors.idempotencyConflict', 409),
    );
  });

  it('does not cache a failed attempt, so a retry after a real failure re-invokes the handler', async () => {
    const key = `k-failure-${Date.now()}`;
    let handlerCalls = 0;
    const body = { a: 1 };
    const failingNext = {
      handle: () => {
        handlerCalls += 1;
        return throwError(() => new Error('downstream failure'));
      },
    };
    const succeedingNext = {
      handle: () => {
        handlerCalls += 1;
        return of({ id: 'created-on-retry' });
      },
    };

    await expect(
      firstValueFrom(
        await interceptor.intercept(
          fakeContext('POST', '/offers', { 'idempotency-key': key }, body),
          failingNext,
        ),
      ),
    ).rejects.toThrow('downstream failure');

    const retried = await firstValueFrom(
      await interceptor.intercept(
        fakeContext('POST', '/offers', { 'idempotency-key': key }, body),
        succeedingNext,
      ),
    );
    expect(retried).toEqual({ id: 'created-on-retry' });
    expect(handlerCalls).toBe(2);
  });
});
