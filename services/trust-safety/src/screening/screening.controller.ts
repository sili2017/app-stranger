import { Body, Controller, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { screenActivityText } from './screening.rules';

class ScreenOfferRequest {
  @IsString()
  activityText!: string;
}

/**
 * Called synchronously by Offer at publish time for every offer (T045), before any
 * entitlement is reserved (FR-039).
 */
@Controller('internal/v1/trust-safety')
export class ScreeningController {
  @Post('screen-offer')
  screenOffer(@Body() body: ScreenOfferRequest) {
    return screenActivityText(body.activityText);
  }
}
