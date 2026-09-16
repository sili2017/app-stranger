import { randomUUID } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DomainError, signSessionToken } from '@stranger/ts-platform';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ageRangeLabelFor } from '../verification/verification.service';
import {
  OAuthIdentity,
  verifyAppleIdToken,
  verifyFacebookAccessToken,
  verifyGoogleIdToken,
} from './oauth-verifiers';

type OAuthProvider = 'google' | 'facebook' | 'apple';

const MIN_AGE_YEARS = 18;
const BCRYPT_ROUNDS = 12;

function isAtLeastMinAge(dob: Date): boolean {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= MIN_AGE_YEARS;
}

/**
 * Item 30: real registration/login — replaces the client-asserted `x-dev-user-id`
 * trust model with actual verified credentials for four paths (30.1.1-30.1.3): email/
 * password, Google, Facebook, Apple. Every path ends the same way — a signed session
 * token (see @stranger/ts-platform's session-tokens.ts) the client then presents as
 * `Authorization: Bearer <token>` on every request, verified for real by every
 * service's shared auth middleware. FR-016's 18+ age-assurance gate applies to all
 * four paths identically, not just the pre-existing dev signup-age-assurance flow.
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Item 33: the primary registration path — name and date of birth only, so a new
   * user is in the app and able to connect with people immediately. Issues a real
   * session token right away, same as every other path; the account just has no
   * email/password (or OAuth link) yet, so it's only reachable from this device until
   * completeProfileEmail runs.
   */
  async registerQuick(firstName: string, dateOfBirth: string) {
    const dob = new Date(dateOfBirth);
    if (!isAtLeastMinAge(dob)) {
      throw new DomainError('UNDERAGE_SIGNUP', 'errors.underageSignup', HttpStatus.FORBIDDEN);
    }
    const account = await this.provisionAccount({
      authProvider: 'quick',
      dateOfBirth: dob,
      firstName,
    });
    return this.issueSession(account.id);
  }

  /**
   * Item 33: adds a real, recoverable email+password credential to the signed-in
   * caller's own account — the deferred "profile completion" step. Works whether the
   * account currently has none (a quick-registered account's first credential) or
   * already has one (changing it); either way this is a set, not a create.
   */
  async completeProfileEmail(userId: string, email: string, password: string) {
    const existing = await this.prisma.userAccount.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      throw new DomainError(
        'EMAIL_ALREADY_REGISTERED',
        'errors.emailAlreadyRegistered',
        HttpStatus.CONFLICT,
      );
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { email, passwordHash },
    });
    return { email };
  }

  /** Item 33: lets the client know whether to prompt "secure your account" (Profile). */
  async me(userId: string) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({ where: { id: userId } });
    return { hasPassword: account.passwordHash != null };
  }

  async registerWithEmail(email: string, password: string, dateOfBirth: string, firstName: string) {
    const dob = new Date(dateOfBirth);
    if (!isAtLeastMinAge(dob)) {
      throw new DomainError('UNDERAGE_SIGNUP', 'errors.underageSignup', HttpStatus.FORBIDDEN);
    }
    const existing = await this.prisma.userAccount.findUnique({ where: { email } });
    if (existing) {
      throw new DomainError(
        'EMAIL_ALREADY_REGISTERED',
        'errors.emailAlreadyRegistered',
        HttpStatus.CONFLICT,
      );
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const account = await this.provisionAccount({
      authProvider: 'email',
      email,
      passwordHash,
      dateOfBirth: dob,
      firstName,
    });
    return this.issueSession(account.id);
  }

  async loginWithEmail(email: string, password: string) {
    const account = await this.prisma.userAccount.findUnique({ where: { email } });
    if (!account?.passwordHash || !(await bcrypt.compare(password, account.passwordHash))) {
      throw new DomainError('INVALID_CREDENTIALS', 'errors.invalidCredentials', HttpStatus.UNAUTHORIZED);
    }
    return this.issueSession(account.id);
  }

  async loginWithOAuth(
    provider: OAuthProvider,
    token: string,
    dateOfBirth: string | undefined,
    firstName: string | undefined,
  ) {
    const identity = await this.verifyProviderToken(provider, token);

    const existing = await this.prisma.userAccount.findUnique({
      where: { authProvider_oauthSubject: { authProvider: provider, oauthSubject: identity.subject } },
    });
    if (existing) {
      return this.issueSession(existing.id);
    }

    // Brand-new account via this provider: no provider reliably hands back a real date
    // of birth, and FR-016's 18+ gate applies regardless of how someone signs up — the
    // client must collect and send one the first time a given provider identity is seen.
    if (!dateOfBirth) {
      throw new DomainError(
        'DATE_OF_BIRTH_REQUIRED',
        'errors.dateOfBirthRequired',
        HttpStatus.BAD_REQUEST,
      );
    }
    const dob = new Date(dateOfBirth);
    if (!isAtLeastMinAge(dob)) {
      throw new DomainError('UNDERAGE_SIGNUP', 'errors.underageSignup', HttpStatus.FORBIDDEN);
    }

    const account = await this.provisionAccount({
      authProvider: provider,
      oauthSubject: identity.subject,
      email: identity.email,
      dateOfBirth: dob,
      firstName: firstName || identity.firstName || '',
    });
    return this.issueSession(account.id);
  }

  private verifyProviderToken(provider: OAuthProvider, token: string): Promise<OAuthIdentity> {
    switch (provider) {
      case 'google':
        return verifyGoogleIdToken(token);
      case 'facebook':
        return verifyFacebookAccessToken(token);
      case 'apple':
        return verifyAppleIdToken(token);
    }
  }

  private async provisionAccount(input: {
    authProvider: 'quick' | 'email' | OAuthProvider;
    dateOfBirth: Date;
    firstName: string;
    email?: string;
    passwordHash?: string;
    oauthSubject?: string;
  }) {
    const id = randomUUID();
    const ageRangeLabel = ageRangeLabelFor(input.dateOfBirth);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.userAccount.create({
          data: {
            id,
            dateOfBirth: input.dateOfBirth,
            ageAssuranceStatus: 'self_declared',
            authProvider: input.authProvider,
            email: input.email,
            passwordHash: input.passwordHash,
            oauthSubject: input.oauthSubject,
          },
        });
        await tx.publicProfile.create({
          data: {
            userId: account.id,
            firstName: input.firstName,
            ageRangeLabel,
            verificationStatus: 'unverified',
          },
        });
        return account;
      });
    } catch (err) {
      // A different provider's account already claims this same email (e.g. Google
      // then later Facebook with the same address) — real account linking is a
      // separate feature; surface a clear, actionable error instead of a raw 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError(
          'EMAIL_ALREADY_REGISTERED',
          'errors.emailAlreadyRegistered',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  private async issueSession(userId: string) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({ where: { id: userId } });
    const token = await signSessionToken({
      userId: account.id,
      ageAssuranceStatus: account.ageAssuranceStatus,
      roles: [],
    });
    return { userId: account.id, token, ageAssuranceStatus: account.ageAssuranceStatus };
  }
}
