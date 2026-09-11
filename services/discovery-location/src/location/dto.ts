import { IsIn, IsLatitude, IsLongitude } from 'class-validator';

export class UpdateLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  /** live_gps for a fresh device sample; last_known when live GPS is unavailable (FR-005). */
  @IsIn(['live_gps', 'last_known'])
  source!: 'live_gps' | 'last_known';
}
