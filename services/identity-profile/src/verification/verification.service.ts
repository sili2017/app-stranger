import { Injectable, HttpStatus } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { IdentityEventsProducer } from '../events/identity-events.producer';
import { AuditLogService } from '../audit/audit-log.service';
import { SignupAgeAssuranceDto, SubmitGovernmentIdDto, AppealDto } from './dto';

/**
 * FR-016: self-declared date of birth is checked against the 18+ floor at signup; a
 * mandatory photo-liveness check runs alongside it. If liveness flags a possible minor
 * despite the 18+ self-declaration, the account is held at
 * `liveness_flagged_pending_id` — a VerificationCase(kind: government_id) must pass
 * before that account's first offer can publish.
 */
@Injectable()
export class VerificationService {
  private static readonly MIN_AGE_YEARS = 18;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: IdentityEventsProducer,
    private readonly audit: AuditLogService,
  ) {}

  async completeSignupAgeAssurance(
    userId: string,
    dto: SignupAgeAssuranceDto,
    correlationId: string,
  ) {
    const dob = new Date(dto.dateOfBirth);
    if (!this.isAtLeastMinAge(dob)) {
      throw new DomainError('UNDERAGE_SIGNUP', 'errors.underageSignup', HttpStatus.FORBIDDEN);
    }

    const ageAssuranceStatus =
      dto.livenessResult === 'passed' ? 'liveness_passed' : 'liveness_flagged_pending_id';

    const ageRangeLabel = ageRangeLabelFor(dob);
    const verificationStatus =
      ageAssuranceStatus === 'liveness_passed' ? 'photo_verified' : 'unverified';

    await this.prisma.$transaction(async (tx) => {
      // No account-provisioning/signup flow exists yet — that's tied to the auth
      // provider decision, which is still open (ADQ-002a, spec.md Assumptions: "the
      // authentication approach has not been chosen"). Until then, this endpoint is the
      // natural first-write moment for a userId minted by the gateway's dev-only OIDC
      // issuer, so it provisions the UserAccount row rather than assuming it exists.
      await tx.userAccount.upsert({
        where: { id: userId },
        create: { id: userId, dateOfBirth: dob, ageAssuranceStatus },
        update: { dateOfBirth: dob, ageAssuranceStatus },
      });

      // Same rationale as UserAccount above: nothing else in this codebase ever creates
      // a PublicProfile row (no name-collection step exists yet, tied to the same open
      // auth/onboarding decision), so without this, data-model.md's public rating
      // summary (FR-024) and profile view (FR-013) silently have no row to refresh or
      // read — signup is the first and only natural provisioning point today.
      await tx.publicProfile.upsert({
        where: { userId },
        create: { userId, firstName: '', ageRangeLabel, verificationStatus },
        update: { ageRangeLabel, verificationStatus },
      });

      if (ageAssuranceStatus === 'liveness_flagged_pending_id') {
        await tx.verificationCase.create({
          data: { userId, kind: 'government_id', status: 'submitted' },
        });
      }
    });

    await this.events.userEligibilityChanged(userId, ageAssuranceStatus, correlationId);
    return { ageAssuranceStatus };
  }

  async submitGovernmentId(userId: string, dto: SubmitGovernmentIdDto, correlationId: string) {
    const pendingCase = await this.prisma.verificationCase.findFirst({
      where: { userId, kind: 'government_id', status: 'submitted' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pendingCase) {
      throw new DomainError('NO_PENDING_ID_CASE', 'errors.noPendingIdCase', HttpStatus.CONFLICT);
    }

    await this.prisma.verificationCase.update({
      where: { id: pendingCase.id },
      data: { evidenceAssetId: dto.evidenceAssetId },
    });

    // Automated pass/fail decisioning is out of this feature's scope; a human/automated
    // reviewer transitions status to passed/rejected via a separate moderation flow
    // (ADQ-002b, still open). No change to ageAssuranceStatus here.
    void correlationId;
    return { verificationCaseId: pendingCase.id, status: 'submitted' };
  }

  /** FR-016 Clarifications: manual appeal for a rejected gov-ID upload or a disputed minor-flag. */
  async submitAppeal(userId: string, dto: AppealDto, correlationId: string) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: { id: dto.verificationCaseId, userId },
    });
    if (!verificationCase) {
      throw new DomainError(
        'CASE_NOT_FOUND',
        'errors.verificationCaseNotFound',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!['flagged', 'rejected'].includes(verificationCase.status)) {
      throw new DomainError(
        'CASE_NOT_APPEALABLE',
        'errors.verificationCaseNotAppealable',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationCase.update({
        where: { id: verificationCase.id },
        data: { status: 'appeal_pending' },
      });
      // Account stays restricted from publishing until the appeal resolves
      // (FR-016 Clarifications).
      await tx.userAccount.update({
        where: { id: userId },
        data: { ageAssuranceStatus: 'id_rejected_appeal_pending' },
      });
    });

    await this.events.userEligibilityChanged(userId, 'id_rejected_appeal_pending', correlationId);
    return { verificationCaseId: verificationCase.id, status: 'appeal_pending' };
  }

  /**
   * T109: moderator-only resolution of a pending appeal, audit-logged. No role check is
   * enforced here yet since no role system exists (ADQ-002a is open) — the same gap as
   * every other moderator-only endpoint in this codebase.
   */
  async resolveAppeal(
    actorUserId: string,
    verificationCaseId: string,
    decision: 'appeal_upheld' | 'appeal_denied',
    correlationId: string,
  ) {
    const verificationCase = await this.prisma.verificationCase.findUnique({
      where: { id: verificationCaseId },
    });
    if (!verificationCase) {
      throw new DomainError(
        'CASE_NOT_FOUND',
        'errors.verificationCaseNotFound',
        HttpStatus.NOT_FOUND,
      );
    }
    if (verificationCase.status !== 'appeal_pending') {
      throw new DomainError(
        'CASE_NOT_APPEAL_PENDING',
        'errors.verificationCaseNotAppealPending',
        HttpStatus.CONFLICT,
      );
    }

    const newAgeAssuranceStatus = decision === 'appeal_upheld' ? 'id_verified' : 'restricted';

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationCase.update({
        where: { id: verificationCaseId },
        data: { status: decision },
      });
      await tx.userAccount.update({
        where: { id: verificationCase.userId },
        data: { ageAssuranceStatus: newAgeAssuranceStatus },
      });
    });

    await this.events.userEligibilityChanged(
      verificationCase.userId,
      newAgeAssuranceStatus,
      correlationId,
    );
    await this.audit.record(
      actorUserId,
      'verification.resolve-appeal',
      'verification_case',
      verificationCaseId,
      {
        decision,
      },
    );

    return { verificationCaseId, status: decision };
  }

  private isAtLeastMinAge(dob: Date): boolean {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age >= VerificationService.MIN_AGE_YEARS;
  }
}

/** data-model.md: "derived, never the exact dateOfBirth — e.g. '25-30'" — 5-year buckets. */
export function ageRangeLabelFor(dob: Date): string {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  const bucketStart = Math.floor(age / 5) * 5;
  return `${bucketStart}-${bucketStart + 5}`;
}
