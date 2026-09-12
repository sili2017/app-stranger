import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateBlockDto {
  @IsString()
  targetUserId!: string;
}

export class CreateReportDto {
  @IsIn(['user', 'offer', 'message', 'rating_feedback', 'photo'])
  subjectType!: 'user' | 'offer' | 'message' | 'rating_feedback' | 'photo';

  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ModerationDecisionDto {
  @IsIn(['block', 'report'])
  subjectType!: 'block' | 'report';

  @IsString()
  caseId!: string;

  @IsIn(['enforced', 'rejected', 'appeal_upheld', 'appeal_denied'])
  decision!: 'enforced' | 'rejected' | 'appeal_upheld' | 'appeal_denied';
}

export class ScreeningOverrideDto {
  @IsString()
  offerId!: string;

  @IsIn(['enforced', 'rejected'])
  decision!: 'enforced' | 'rejected';

  @IsOptional()
  @IsString()
  reason?: string;
}

/** Convergence T128 (FR-039): a creator's self-service appeal of a screening rejection. */
export class SubmitScreeningAppealDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
