import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { TrustSafetyEventsProducer } from '../events/trust-safety-events.producer';
import { AuditLogService } from '../audit/audit-log.service';
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
   * T109: audit-logged moderator override of an FR-039 automated screening decision.
   * The screening result itself lives on Offer's own `MeetOffer` row (Trust & Safety
   * doesn't own it), so this records the decision and emits `trust.moderation-
   * decisioned(subjectType: offer_screening)` for Offer to eventually consume — that
   * consumer is a known gap (see T094's notes), so today this only produces the audit
   * trail and the event, not an actual unpublish.
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
    return { offerId, decision };
  }
}
