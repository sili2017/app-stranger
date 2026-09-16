import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DomainError } from '@stranger/ts-platform';
import { AuthService } from './auth.service';
import { LoginEmailDto, OAuthLoginDto, RegisterEmailDto } from './dto';

const OAUTH_PROVIDERS = ['google', 'facebook', 'apple'] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Item 30: registration/login — see auth.service.ts for the full design rationale. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
