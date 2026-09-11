import { Body, Controller, Post } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

interface AuthorizeRequest {
  userId: string;
  offerId: string;
}

/**
 * T099: replaces the Foundational always-granted stub (T039) with real free-allowance/
 * subscription/one-time-purchase logic. Offer's call site
 * (`POST /internal/v1/entitlements/authorize`) is unchanged.
 */
@Controller('internal/v1/entitlements')
export class AuthorizeController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Post('authorize')
  async authorize(@Body() body: AuthorizeRequest) {
    const result = await this.entitlements.authorize(body.userId, body.offerId);
    return { ...result, userId: body.userId, offerId: body.offerId };
  }
}
