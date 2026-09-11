import { IsOptional, IsString } from 'class-validator';

export class ExpressInterestDto {
  @IsOptional()
  @IsString()
  message?: string;
}

export class SelectRecipientDto {
  @IsString()
  expressionOfInterestId!: string;
}
