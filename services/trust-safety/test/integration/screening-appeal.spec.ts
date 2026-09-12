import 'reflect-metadata';
import { ModerationService } from '../../src/moderation/moderation.service';
import { AuditLogService } from '../../src/audit/audit-log.service';
import { TrustSafetyEventsProducer } from '../../src/events/trust-safety-events.producer';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T128 (FR-039, Clarifications Session 2026-09-12 round 2): a creator's
 * self-service appeal of an automated screening rejection.
 */
describe('Screening appeal (T128, FR-039)', () => {
  function buildService(offerStatus: { status: string; creatorUserId: string } | null) {
    const prisma = new FakePrismaService();
    const events = new TrustSafetyEventsProducer();
    const audit = new AuditLogService(prisma as any);
    const internal = { getOfferCreator: async () => null, getOfferStatus: async () => offerStatus };
    const service = new ModerationService(prisma as any, events, audit, internal as any);
    return { service, prisma };
  }

  it('rejects an appeal from someone other than the offer creator', async () => {
    const { service } = buildService({ status: 'screening_rejected', creatorUserId: 'creator-1' });

    let caught: unknown;
    try {
      await service.submitScreeningAppeal('someone-else', 'offer-1', undefined);
    } catch (err) {
      caught = err;
    }
    expect((caught as { code?: string })?.code).toBe('UNAUTHORIZED');
  });

  it('rejects an appeal for an offer that is not screening_rejected', async () => {
    const { service } = buildService({ status: 'active', creatorUserId: 'creator-1' });

    let caught: unknown;
    try {
      await service.submitScreeningAppeal('creator-1', 'offer-1', undefined);
    } catch (err) {
      caught = err;
    }
    expect((caught as { code?: string })?.code).toBe('NOT_APPEALABLE');
  });

  it('accepts a valid appeal and is idempotent on retry', async () => {
    const { service } = buildService({ status: 'screening_rejected', creatorUserId: 'creator-1' });

    const first = await service.submitScreeningAppeal('creator-1', 'offer-1', 'this was a false positive');
    const retry = await service.submitScreeningAppeal('creator-1', 'offer-1', 'this was a false positive');

    expect(first.status).toBe('submitted');
    expect(retry.id).toBe(first.id);
  });

  it('marks the appeal upheld when the moderator overturns the screening decision', async () => {
    const { service, prisma } = buildService({ status: 'screening_rejected', creatorUserId: 'creator-1' });
    const appeal = await service.submitScreeningAppeal('creator-1', 'offer-1', undefined);

    await service.overrideScreening('moderator-1', 'offer-1', 'rejected', 'false positive', 'corr-1');

    const updated = await prisma.screeningAppeal.findMany({ where: { offerId: 'offer-1' } });
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(appeal.id);
    expect(updated[0].status).toBe('upheld');
  });

  it('marks the appeal denied when the moderator enforces (upholds) the screening decision', async () => {
    const { service, prisma } = buildService({ status: 'screening_rejected', creatorUserId: 'creator-1' });
    await service.submitScreeningAppeal('creator-1', 'offer-1', undefined);

    await service.overrideScreening('moderator-1', 'offer-1', 'enforced', 'still a violation', 'corr-1');

    const updated = await prisma.screeningAppeal.findMany({ where: { offerId: 'offer-1' } });
    expect(updated[0].status).toBe('denied');
  });
});
