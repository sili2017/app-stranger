import { IsString } from 'class-validator';

export class CreateCityInterestDto {
  @IsString()
  cityId!: string;
}
