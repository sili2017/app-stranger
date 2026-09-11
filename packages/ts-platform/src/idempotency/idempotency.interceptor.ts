import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap, map } from 'rxjs/operators';
import { DomainError } from '../errors/error-envelope';

interface StoredResult {
  bodyHash: string;
  status: number;
  body: unknown;
}

/**
 * Enforces contracts/api-standards.md §Idempotency: "a repeated key with the same body
 * returns the original result rather than creating a second resource." Applied globally
 * per service (see each service's main.ts) rather than per-endpoint, since the contract's
 * named examples (publish offer, express interest, select participant, confirm purchase)
 * are illustrative of "every state-changing endpoint a client retry could duplicate," not
 * an exhaustive allowlist — this is a no-op for any request that omits the header.
 *
 * Two-phase claim via Redis SET NX avoids a race between two concurrent requests that
 * share the same key: the second one to arrive while the first is still in flight gets a
 * 409 rather than double-executing the handler. The cache write/delete after the handler
 * runs is awaited *inside* the observable chain (not fire-and-forget) so a client retry
 * can never race ahead of its own request's outcome being recorded.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 24 * 60 * 60,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['idempotency-key'];
    if (request.method !== 'POST' || !key) {
      return next.handle();
    }

    const cacheKey = `idempotency:${request.path}:${key}`;
    const bodyHash = hashBody(request.body);

    const claimed = await this.redis.set(cacheKey, 'pending', 'EX', this.ttlSeconds, 'NX');
    if (claimed !== 'OK') {
      const existing = await this.redis.get(cacheKey);
      if (!existing || existing === 'pending') {
        throw new DomainError('IDEMPOTENCY_KEY_IN_PROGRESS', 'errors.idempotencyInProgress', 409);
      }
      const stored = JSON.parse(existing) as StoredResult;
      if (stored.bodyHash !== bodyHash) {
        throw new DomainError('IDEMPOTENCY_KEY_CONFLICT', 'errors.idempotencyConflict', 409);
      }
      context.switchToHttp().getResponse().status(stored.status);
      return of(stored.body);
    }

    return next.handle().pipe(
      concatMap((body) => {
        const status = context.switchToHttp().getResponse().statusCode;
        const toStore: StoredResult = { bodyHash, status, body };
        return from(this.redis.set(cacheKey, JSON.stringify(toStore), 'EX', this.ttlSeconds)).pipe(
          map(() => body),
        );
      }),
      catchError((err) =>
        // Never cache a failed attempt — let the client legitimately retry with the same
        // key once the transient failure clears, per api-standards.md's retry guidance
        // (only documented-idempotent operations are safe to retry, and a retry after a
        // genuine failure must not be treated as a duplicate).
        from(this.redis.del(cacheKey)).pipe(concatMap(() => throwError(() => err))),
      ),
    );
  }
}

function hashBody(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');
}
