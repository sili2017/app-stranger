import 'reflect-metadata';
import { EntitlementsService } from '../../src/entitlements.service';
import { FakePrismaService } from '../fake-prisma';

/**
 * T095: three successful publishes consume the free allowance 2 -> 1 -> 0; a fourth
 * returns rejected (SC-013). Exercised against an in-memory Prisma double (no live
 * Postgres in this environment — the same flow was verified live against real
 * Postgres/Redis during development, see conversation record).
 */
describe('Free allowance consumption (T095, SC-013)', () => {
  it('grants the first three publishes via free_allowance, then rejects the fourth', async () => {
    const prisma = new FakePrismaService();
    const service = new EntitlementsService(prisma as any);

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await service.authorize('user-1', `offer-${i}`));
    }

    expect(results[0]).toEqual({ decision: 'granted', entitlementSource: 'free_allowance' });
    expect(results[1]).toEqual({ decision: 'granted', entitlementSource: 'free_allowance' });
    expect(results[2]).toEqual({ decision: 'granted', entitlementSource: 'free_allowance' });
    expect(results[3]).toEqual({ decision: 'rejected' });

    const status = await service.getEntitlementStatus('user-1');
    expect(status.remainingFreeAllowanceThisMonth).toBe(0);
  });
});
