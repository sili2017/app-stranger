import { IsDateString, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * Item 33: the only real registration path now — name and date of birth, nothing
 * else, so a new user reaches the app (and can start connecting with people) as fast
 * as possible. Email/password is a later, optional "complete your profile" step (see
 * CompleteProfileEmailDto) rather than a signup requirement.
 */
export class RegisterQuickDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsDateString()
  dateOfBirth!: string;
}

/**
 * Item 33: adds a real, recoverable credential to the *currently signed-in* account
 * (see AuthController.completeProfileEmail) — this is "profile completion," not
 * registration. A quick-registered account has no email/password at all until this
 * runs, so it's only reachable from the device that registered it; this is what makes
 * it reachable from anywhere.
 */
export class CompleteProfileEmailDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}

/** Item 30.1.3: real email/password registration in one step — still available as a
 * direct alternative to quick-register + complete-profile, just no longer the primary
 * signup path surfaced in the client (see item 33). */
export class RegisterEmailDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;
}

/**
 * Item 35: [phone] must already be combined into E.164 (leading "+", country code
 * folded in — e.g. "+14155552671") by the caller. Kept as one field rather than a
 * separate country-code param: E.164 *is* "phone number along with country code," and
 * every downstream use (SMS delivery, the uniqueness constraint, display) wants the
 * single canonical form rather than reassembling it from parts every time.
 */
export class SetPhoneDto {
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be in E.164 format, e.g. +14155552671',
  })
  phone!: string;
}

export class VerifyPhoneDto {
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'code must be a 4-8 digit number' })
  code!: string;
}

export class LoginEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

/**
 * Items 30.1.1/30.1.2: Google, Facebook, or Apple (the provider itself is a path
 * param — see AuthController). `token` is the provider's own ID token for
 * Google/Apple, or the access token for Facebook — never a client-asserted userId.
 */
export class OAuthLoginDto {
  @IsString()
  token!: string;

  // Only required (and only used) the first time a given provider identity is seen —
  // no provider reliably hands back a real date of birth, and FR-016's 18+ gate
  // applies regardless of how someone signs up. Ignored for a returning account.
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  firstName?: string;
}
