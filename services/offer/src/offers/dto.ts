import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class PlaceDto {
  @IsIn(['pin', 'venue', 'live', 'moving'])
  kind!: 'pin' | 'venue' | 'live' | 'moving';

  @IsOptional()
  @IsString()
  label?: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  // Required when kind == moving or a queue-style spot without a fixed venue (FR-002).
  // Enforced in OffersService rather than purely via decorator, since "queue-style spot
  // without a fixed venue" isn't derivable from `kind` alone for pin/venue.
  @ValidateIf((o) => o.kind === 'moving')
  @IsString()
  rendezvousInstruction?: string;
}

export class MoneyPreferenceDto {
  @IsIn(['creator_pays', 'byo', 'split', 'estimated_cost'])
  label!: 'creator_pays' | 'byo' | 'split' | 'estimated_cost';

  @IsOptional()
  @IsString()
  note?: string;
}

export class PublishOfferDto {
  @IsString()
  activityText!: string;

  @ValidateNested()
  @Type(() => PlaceDto)
  place!: PlaceDto;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  lifetimeMinutes?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  capacity!: number;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyPreferenceDto)
  moneyPreference?: MoneyPreferenceDto;

  @IsOptional()
  @IsString()
  suggestionActivityKey?: string;

  @IsOptional()
  @IsString()
  suggestionEmoji?: string;

  // A rendezvousInstruction is also required for a queue-style pin/venue without a
  // fixed venue; the client sets this flag since the server can't infer "queue-style"
  // from coordinates alone.
  @IsOptional()
  isQueueStyleWithoutFixedVenue?: boolean;
}
