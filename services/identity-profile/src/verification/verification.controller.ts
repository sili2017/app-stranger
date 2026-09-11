import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { VerificationService } from './verification.service';
import { SignupAgeAssuranceDto, SubmitGovernmentIdDto } from './dto';

/** T112: every public endpoint carries an explicit rate limit (contracts/api-standards.md §Rate Limits). */
@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('signup-age-assurance')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async completeSignup(@Body() dto: SignupAgeAssuranceDto, @Req() req: Request) {
    const userId = (req as any).verifiedPrincipal?.userId;
    const correlationId = (req as any).correlationId ?? 'unknown';
    return this.verification.completeSignupAgeAssurance(userId, dto, correlationId);
  }

  @Post('government-id')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submitGovernmentId(@Body() dto: SubmitGovernmentIdDto, @Req() req: Request) {
    const userId = (req as any).verifiedPrincipal?.userId;
    const correlationId = (req as any).correlationId ?? 'unknown';
    return this.verification.submitGovernmentId(userId, dto, correlationId);
  }
}
