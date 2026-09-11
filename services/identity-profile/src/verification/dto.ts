import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

/** Mandatory signup age-assurance input (FR-016): self-declared DOB + a liveness check result. */
export class SignupAgeAssuranceDto {
  @IsDateString()
  dateOfBirth!: string;

  /** Result of the client-side photo liveness check step. */
  @IsIn(['passed', 'flagged_possible_minor'])
  livenessResult!: 'passed' | 'flagged_possible_minor';
}

export class SubmitGovernmentIdDto {
  @IsString()
  evidenceAssetId!: string;
}

export class AppealDto {
  @IsString()
  verificationCaseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveAppealDto {
  @IsString()
  verificationCaseId!: string;

  @IsIn(['appeal_upheld', 'appeal_denied'])
  decision!: 'appeal_upheld' | 'appeal_denied';
}
