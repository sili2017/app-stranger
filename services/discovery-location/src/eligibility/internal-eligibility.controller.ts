import { Controller, Get, Param, Query } from '@nestjs/common';
import { EligibilityService } from './eligibility.service';

/**
 * Internal contract consumed by Participation at write time (see
 * contracts/public/offer-service.md's express-interest endpoint) to close the race
 * edge case where an offer's eligibility read model or the offer itself changes
 * between a client's last read and its write.
 */
@Controller('internal/v1/discovery')
export class InternalEligibilityController {
  constructor(private readonly eligibility: EligibilityService) {}

  @Get('eligibility')
  async check(
    @Query('offerId') offerId: string,
    @Query('recipientUserId') recipientUserId: string,
  ) {
    const eligible = await this.eligibility.isEligible(recipientUserId, offerId);
    return { eligible };
  }

  /** Convergence T125 (FR-006): consumed by Notification's offer.published fan-out. */
  @Get('offers/:offerId/eligible-recipients')
  async eligibleRecipients(@Param('offerId') offerId: string) {
    const recipientUserIds = await this.eligibility.listEligibleRecipientsForOffer(offerId);
    return { recipientUserIds };
  }
}
