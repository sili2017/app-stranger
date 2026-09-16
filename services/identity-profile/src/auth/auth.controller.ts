import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { DomainError } from '@stranger/ts-platform';
import { AuthService } from './auth.service';
import {
  CompleteProfileEmailDto,
  LoginEmailDto,
  OAuthLoginDto,
  RegisterEmailDto,
  RegisterQuickDto,
} from './dto';

const OAUTH_PROVIDERS = ['google', 'facebook', 'apple'] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function authenticatedUserId(req: Request): string {
  const userId = (req as any).verifiedPrincipal?.userId as string | undefined;
  if (!userId) {
    throw new DomainError('UNAUTHENTICATED', 'errors.unauthenticated', HttpStatus.UNAUTHORIZED);
  }
  return userId;
}

/** Item 30/33: registration/login — see auth.service.ts for the full design rationale. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Item 33: the primary signup path — name + date of birth only. */
  @Post('register/quick')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registerQuick(@Body() dto: RegisterQuickDto) {
    return this.auth.registerQuick(dto.firstName, dto.dateOfBirth);
  }

  /**
   * Item 33: the deferred "profile completion" step — adds a real email+password
   * credential to whichever account this bearer session belongs to.
   */
  @Post('complete-profile/email')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async completeProfileEmail(@Body() dto: CompleteProfileEmailDto, @Req() req: Request) {
    return this.auth.completeProfileEmail(authenticatedUserId(req), dto.email, dto.password);
  }

  /** Item 33: lets the client decide whether to show the "secure your account" prompt. */
  @Get('me')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async me(@Req() req: Request) {
    return this.auth.me(authenticatedUserId(req));
  }

  /** Item 30.1.3: still available as a direct one-step alternative — see dto.ts. */
  @Post('register/email')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registerEmail(@Body() dto: RegisterEmailDto) {
    return this.auth.registerWithEmail(dto.email, dto.password, dto.dateOfBirth, dto.firstName);
  }

  @Post('login/email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginEmail(@Body() dto: LoginEmailDto) {
    return this.auth.loginWithEmail(dto.email, dto.password);
  }

  @Post('oauth/:provider/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginOAuth(@Param('provider') provider: string, @Body() dto: OAuthLoginDto) {
    if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
      throw new DomainError('UNKNOWN_PROVIDER', 'errors.unknownProvider', HttpStatus.BAD_REQUEST);
    }
    return this.auth.loginWithOAuth(provider as OAuthProvider, dto.token, dto.dateOfBirth, dto.firstName);
  }

  /**
   * Item 30.2: session tokens are stateless (see session-tokens.ts) — there is nothing
   * server-side to revoke today. This endpoint exists so the client always has a real
   * call to make on logout (and so a future revocation list has somewhere to plug in
   * without a client-side contract change); the client's own token discard is what
   * actually ends the session on this device.
   */
  @Post('logout')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async logout(): Promise<void> {
    return;
  }
}
