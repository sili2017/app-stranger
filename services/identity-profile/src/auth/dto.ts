import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** Item 30.1.3: real email/password registration. */
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
