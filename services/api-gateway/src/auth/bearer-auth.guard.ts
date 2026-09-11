import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { HttpStatus } from '@nestjs/common';
import { DevOidcIssuer } from './dev-oidc-issuer';
import { VerifiedPrincipal } from './verified-principal';

/**
 * Validates the OAuth2/OIDC bearer token once at the gateway (contracts/api-standards.md
 * §Authentication & Authorization) and attaches the VerifiedPrincipal to the request for
 * the routing layer to forward downstream as a signed internal principal.
 */
@Injectable()
export class BearerAuthGuard implements CanActivate {
  private readonly issuer = new DevOidcIssuer();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new DomainError('UNAUTHENTICATED', 'errors.unauthenticated', HttpStatus.UNAUTHORIZED);
    }
    const token = header.slice('Bearer '.length);
    try {
      const claims = await this.issuer.verify(token);
      const principal: VerifiedPrincipal = {
        userId: claims.userId,
        ageAssuranceStatus: claims.ageAssuranceStatus,
        roles: claims.roles,
      };
      request.verifiedPrincipal = principal;
      return true;
    } catch {
      throw new DomainError('UNAUTHENTICATED', 'errors.unauthenticated', HttpStatus.UNAUTHORIZED);
    }
  }
}
