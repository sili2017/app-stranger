import { IsIn, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsIn(['weekly', 'monthly', 'yearly'])
  plan!: 'weekly' | 'monthly' | 'yearly';

  @IsString()
  receiptToken!: string;
}

export class PurchaseBroadcastDto {
  @IsString()
  receiptToken!: string;
}
