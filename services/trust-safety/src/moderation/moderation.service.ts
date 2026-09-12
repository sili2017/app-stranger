import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { TrustSafetyEventsProducer } from '../events/trust-safety-events.producer';
import { AuditLogService } from '../audit/audit-log.service';
import { InternalClients } from '../rating/internal-clients';
import { ModerationDecisionDto } from './dto';

/**
 * T090/T091: a block or report request is routed to pending_review, but the submitter's
 * own view updates immediately (FR-015, Clarifications) — satisfied here by `listMine`
 * reflecting the block/report the instant it's created, independent of `status`.
 * Moderation review must complete within 4 hours of submission (spec.md Clarifications,
 * 2026-09-11) — enforcing that SLA operationally (staffing/alerting) is outside this
 * service's code and tracked in checklists/security.md CHK005.
 */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TrustSafetyEventsProducer,
    private readonly audit: AuditLogService,
    private readonly internal: InternalClients,
  ) {}

  async createBlock(sourceUserId: string, targetUserId: string) {
    return this.prisma.block.upsert({
      where: { sourceUserId_targetUserId: { sourceUserId, targetUserId } },
      create: { sourceUserId, targetUserId },
      update: {},
    });
  }

  /** The submitter's own block list — reflects every block immediately, any status. */
  async listMyBlocks(sourceUserId: string) {
    return this.prisma.block.findMany({ where: { sourceUserId } });
  }

  /**
   * Convergence T126 (FR-015, Constitution §3.V): the enforcement rule other services
   * call to decide whether userId should see/contact otherUserId. A submitter's own
   * block excludes the target from *their* view immediately, any status (matches
   * listMyBlocks/T090's existing submitter-side rule); the other direction only takes
   * effect once a block is `enforced` by moderation review, per FR-015's "takes effect
   * broadly... between the two users" only after review.
   */
  async isBlocked(userId: string, otherUserId: string): Promise<boolean> {
    const [ownBlock, blockedByOther] = await Promise.all([
      this.prisma.block.findUnique({
        where: { sourceUserId_targetUserId: { sourceUserId: userId, targetUserId: otherUserId } },
      }),
      this.prisma.block.findUnique({
        where: { sourceUserId_targetUserId: { sourceUserId: otherUserId, targetUserId: userId } },
      }),
    ]);
    if (ownBlock) return true;
    if (blockedByOther?.status === 'enforced') return true;
    return false;
  }

  async createReport(
    reporterUserId: string,
    subjectType: 'user' | 'offer' | 'message' | 'rating_feedback' | 'photo',
    subjectId: string,
    reason: string | undefined,
  ) {
    return this.prisma.report.create({ data: { reporterUserId, subjectType, subjectId, reason } });
  }

  /**
   * T094: opaque case id + routing metadata only — report/evidence content never leaves
   * this service (constitution §3.V). Moderator/admin-only in a production deployment;
   * no role check is enforced here yet since no role system exists (ADQ-002a is open).
   */
  async decide(actorUserId: string, dto: ModerationDecisionDto, correlationId: string) {
    const decidedAt = new Date();
    if (dto.subjectType === 'block') {
      const block = await this.prisma.block.findUnique({ where: { id: dto.caseId } });
      if (!block) {
        throw new DomainError('CASE_NOT_FOUND', 'errors.caseNotFound', HttpStatus.NOT_FOUND);
      }
      const status = dto.decision === 'enforced' ? 'enforced' : 'rejected';
      await this.prisma.$transaction(async (tx) => {
        await tx.block.update({ where: { id: dto.caseId }, data: { status, decidedAt } });
        await this.events.moderationDecisioned(
          tx as unknown as PrismaService,
          {
            caseId: dto.caseId,
            subjectType: 'block',
            subjectId: block.targetUserId,
            decision: dto.decision,
          },
          correlationId,
        );
      });
      await this.audit.record(actorUserId, 'moderation.decide', 'block', dto.caseId, {
        decision: dto.decision,
      });
    } else {
      const report = await this.prisma.report.findUnique({ where: { id: dto.caseId } });
      if (!report) {
        throw new DomainError('CASE_NOT_FOUND', 'errors.caseNotFound', HttpStatus.NOT_FOUND);
      }
      const status = dto.decision === 'enforced' ? 'enforced' : 'rejected';
      await this.prisma.$transaction(async (tx) => {
        await tx.report.update({ where: { id: dto.caseId }, data: { status, decidedAt } });
        await this.events.moderationDecisioned(
          tx as unknown as PrismaService,
          {
            caseId: dto.caseId,
            subjectType: 'report',
            subjectId: report.subjectId,
            decision: dto.decision,
          },
          correlationId,
        );
      });
      await this.audit.record(actorUserId, 'moderation.decide', 'report', dto.caseId, {
        decision: dto.decision,
      });
    }
    return { caseId: dto.caseId, decision: dto.decision };
  }

  /**
   * T109, extended by Convergence T135: audit-logged moderator override of an FR-039
   * automated screening decision. Emits `trust.moderation-decisioned(subjectType:
   * offer_screening)`, now actually consumed by Offer (T135) to restore the offer when
   * `decision === 'rejected'` (the automated rejection is itself overturned). Also
   * syncs a ScreeningAppeal row (T128) if the creator submitted one, so their appeal
   * shows a final status even though the decision itself lives on this event/audit
   * trail, not the appeal row.
   */
  async overrideScreening(
    actorUserId: string,
    offerId: string,
    decision: 'enforced' | 'rejected',
    reason: string | undefined,
    correlationId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.events.moderationDecisioned(
        tx as unknown as PrismaService,
        { caseId: offerId, subjectType: 'offer_screening', subjectId: offerId, decision },
        correlationId,
      );
    });
    await this.audit.record(actorUserId, 'screening.override', 'offer', offerId, {
      decision,
      reason,
    });

    const appeals = await this.prisma.screeningAppeal.findMany({ where: { offerId } });
    for (const appeal of appeals) {
      await this.prisma.screeningAppeal.update({
        where: { id: appeal.id },
        data: {
          status: decision === 'rejected' ? 'upheld' : 'denied',
          decidedAt: new Date(),
        },
      });
    }

    return { offerId, decision };
  }

  /**
   * Convergence T128 (FR-039, Clarifications Session 2026-09-12 round 2): a creator's
   * self-service appeal of a screening rejection, mirroring VerificationCase's appeal
   * shape. Verifies against Offer's own live status rather than trusting the caller.
   */
  async submitScreeningAppeal(creatorUserId: string, offerId: string, reason: string | undefined) {
    const offer = await this.internal.getOfferStatus(offerId);
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    if (offer.creatorUserId !== creatorUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    if (offer.status !== 'screening_rejected') {
      throw new DomainError(
        'NOT_APPEALABLE',
        'errors.notAppealable',
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.screeningAppeal.upsert({
      where: { offerId_creatorUserId: { offerId, creatorUserId } },
      create: { offerId, creatorUserId, reason },
      update: {}, // a retried submission is idempotent, not a second appeal
    });
  }
}
