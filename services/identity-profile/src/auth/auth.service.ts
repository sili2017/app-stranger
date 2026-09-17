import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
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
import { createEmailSender, EmailSender } from './email-sender';
import { createSmsSender, SmsSender } from './sms-sender';

type OAuthProvider = 'google' | 'facebook' | 'apple';

const MIN_AGE_YEARS = 18;
const BCRYPT_ROUNDS = 12;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PHONE_CODE_TTL_MS = 10 * 60 * 1000;
const PHONE_CODE_MAX_ATTEMPTS = 5;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generatePhoneCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

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
  private readonly emailSender: EmailSender = createEmailSender();
  private readonly smsSender: SmsSender = createSmsSender();

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
    // Item 35: a changed email hasn't been proven reachable yet, even if some earlier
    // address on this account was.
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { email, passwordHash, emailVerified: false },
    });
    await this.sendEmailVerification(userId, email);
    return { email };
  }

  /** Item 33/35: lets the client know whether to prompt "secure your account" and
   * show the right email/phone verification state (Profile, VerificationScreen). */
  async me(userId: string) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({ where: { id: userId } });
    return {
      hasPassword: account.passwordHash != null,
      email: account.email,
      emailVerified: account.emailVerified,
      phone: account.phone,
      phoneVerified: account.phoneVerified,
    };
  }

  /** Item 35: re-sends the confirmation link — the first one may have expired or
   * never arrived. No-ops with a clear error if there's no email on file yet. */
  async resendEmailVerification(userId: string) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({ where: { id: userId } });
    if (!account.email) {
      throw new DomainError('NO_EMAIL_SET', 'errors.noEmailSet', HttpStatus.CONFLICT);
    }
    if (account.emailVerified) {
      return { email: account.email };
    }
    await this.sendEmailVerification(userId, account.email);
    return { email: account.email };
  }

  /**
   * Item 35: the link a user clicks from their inbox — deliberately unauthenticated
   * (see AuthController/main.ts's publicPaths), since the click happens in whatever
   * browser they read email in, not necessarily one signed into this account. The
   * token itself is what proves it's really them.
   */
  async verifyEmailByToken(token: string): Promise<boolean> {
    const tokenHash = hashToken(token);
    const row = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!row || row.expiresAt < new Date()) {
      return false;
    }
    await this.prisma.$transaction([
      this.prisma.userAccount.update({
        where: { id: row.userId },
        data: { emailVerified: true },
      }),
      // Single-use: every outstanding link for this user is spent once any one of
      // them succeeds, not just the one that was clicked.
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } }),
    ]);
    return true;
  }

  /** Item 35: sets/changes the signed-in caller's phone number and immediately sends
   * a one-time code to it — never verified just by being saved. */
  async setPhone(userId: string, phone: string) {
    const existing = await this.prisma.userAccount.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new DomainError(
        'PHONE_ALREADY_REGISTERED',
        'errors.phoneAlreadyRegistered',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { phone, phoneVerified: false },
    });
    await this.sendPhoneCode(userId, phone);
    return { phone };
  }

  /** Item 35: re-sends the code to whatever phone is currently on file. */
  async resendPhoneCode(userId: string) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({ where: { id: userId } });
    if (!account.phone) {
      throw new DomainError('NO_PHONE_SET', 'errors.noPhoneSet', HttpStatus.CONFLICT);
    }
    if (account.phoneVerified) {
      return { phone: account.phone };
    }
    await this.sendPhoneCode(userId, account.phone);
    return { phone: account.phone };
  }

  async verifyPhone(userId: string, code: string) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({ where: { id: userId } });
    if (!account.phone) {
      throw new DomainError('NO_PHONE_SET', 'errors.noPhoneSet', HttpStatus.CONFLICT);
    }
    const pending = await this.prisma.phoneVerificationCode.findFirst({
      where: { userId, phone: account.phone },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending || pending.expiresAt < new Date()) {
      throw new DomainError('CODE_EXPIRED', 'errors.codeExpired', HttpStatus.BAD_REQUEST);
    }
    if (pending.attempts >= PHONE_CODE_MAX_ATTEMPTS) {
      throw new DomainError(
        'TOO_MANY_ATTEMPTS',
        'errors.tooManyAttempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const matches = await bcrypt.compare(code, pending.codeHash);
    if (!matches) {
      await this.prisma.phoneVerificationCode.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new DomainError('INVALID_CODE', 'errors.invalidCode', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.$transaction([
      this.prisma.userAccount.update({ where: { id: userId }, data: { phoneVerified: true } }),
      this.prisma.phoneVerificationCode.deleteMany({ where: { userId } }),
    ]);
    return { phoneVerified: true };
  }

  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    const link = `${PUBLIC_BASE_URL}/auth/email/verify?token=${token}`;
    await this.emailSender.send(
      email,
      'Confirm your email for Stranger',
      `Tap this link to confirm your email address:\n\n${link}\n\nThis link expires in 24 hours.`,
    );
  }

  private async sendPhoneCode(userId: string, phone: string): Promise<void> {
    const code = generatePhoneCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    await this.prisma.phoneVerificationCode.create({
      data: {
        userId,
        phone,
        codeHash,
        expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MS),
      },
    });
    await this.smsSender.send(
      phone,
      `Your Stranger verification code is ${code}. It expires in 10 minutes.`,
    );
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
    await this.sendEmailVerification(account.id, email);
    return this.issueSession(account.id);
  }

  async loginWithEmail(email: string, password: string) {
    const account = await this.prisma.userAccount.findUnique({ where: { email } });
    if (!account?.passwordHash || !(await bcrypt.compare(password, account.passwordHash))) {
      throw new DomainError(
        'INVALID_CREDENTIALS',
        'errors.invalidCredentials',
        HttpStatus.UNAUTHORIZED,
      );
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
      where: {
        authProvider_oauthSubject: { authProvider: provider, oauthSubject: identity.subject },
      },
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
            // Item 35: Google/Facebook/Apple only ever hand back an email they've
            // already confirmed the person controls — an `email`-provider account
            // (plain password signup) hasn't proven that yet, so it starts false and
            // registerWithEmail sends a real confirmation link right after.
            emailVerified: input.oauthSubject != null && input.email != null,
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
