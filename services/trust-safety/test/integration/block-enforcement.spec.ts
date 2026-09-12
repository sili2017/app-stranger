import 'reflect-metadata';
import { ModerationService } from '../../src/moderation/moderation.service';
import { AuditLogService } from '../../src/audit/audit-log.service';
import { TrustSafetyEventsProducer } from '../../src/events/trust-safety-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T126 (FR-015): the submitter's own block excludes the target
 * immediately, any status; the other direction only takes effect once a block is
 * `enforced` by moderation review — matching FR-015's "takes effect broadly... between
 * the two users" only after review, versus the submitter's own immediate exclusion.
 */
describe('ModerationService.isBlocked (T126, FR-015)', () => {
  function buildService() {
    const prisma = new FakePrismaService();
    const events = new TrustSafetyEventsProducer();
    const audit = new AuditLogService(prisma as any);
    const internal = { getOfferCreator: async () => null, getOfferStatus: async () => null };
    const service = new ModerationService(prisma as any, events, audit, internal as any);
    return { service, prisma };
  }

  it("excludes the target from the submitter's own view immediately, even pending review", async () => {
    const { service } = buildService();
    await service.createBlock('user-a', 'user-b');

    expect(await service.isBlocked('user-a', 'user-b')).toBe(true);
    // The other direction has no effect yet — review hasn't enforced it.
    expect(await service.isBlocked('user-b', 'user-a')).toBe(false);
  });

  it('applies the block in both directions once moderation enforces it', async () => {
    const { service, prisma } = buildService();
    // Sets up the post-decide() state directly (decide()'s own transaction/audit/event
    // side effects are exercised elsewhere, not by this isBlocked unit).
    await prisma.block.upsert({
      where: { sourceUserId_targetUserId: { sourceUserId: 'user-a', targetUserId: 'user-b' } },
      create: { sourceUserId: 'user-a', targetUserId: 'user-b', status: 'enforced' },
    });

    expect(await service.isBlocked('user-b', 'user-a')).toBe(true);
  });

  it('returns false when no block exists in either direction', async () => {
    const { service } = buildService();
    expect(await service.isBlocked('user-a', 'user-b')).toBe(false);
  });
});
