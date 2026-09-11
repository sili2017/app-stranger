import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitRatingDto {
  @IsString()
  selectionId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  starRating!: number;

  @IsOptional()
  @IsString()
  writtenFeedback?: string;

  @IsOptional()
  @IsString()
  photoAssetId?: string;

  /** Other identifiable people shown in the photo, each requiring their own consent (FR-029). */
  @IsOptional()
  photoSubjectUserIds?: string[];
}

export class ConsentToPhotoDto {
  @IsString()
  ratingFeedbackId!: string;
}
