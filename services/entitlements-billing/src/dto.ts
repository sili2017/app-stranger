import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsIn(['weekly', 'monthly', 'yearly'])
  plan!: 'weekly' | 'monthly' | 'yearly';

  @IsString()
  receiptToken!: string;

  // T124/ADR-009: set when receiptToken is a Stripe Checkout Session id, so the
  // webhook can later find this row by Stripe's own subscription id.
  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string;
}

export class PurchaseBroadcastDto {
  @IsString()
  receiptToken!: string;
}
