import { IsIn, IsString, MaxLength } from 'class-validator';

/** Base64-encoded body rather than multipart/form-data — avoids adding a multer/file-
 * interceptor dependency for a dev-only local-filesystem-backed upload; a real provider
 * swap (ADQ-005) would introduce presigned-URL uploads anyway, which look nothing like
 * either transport, so there's no "more correct" choice being skipped here. */
export class UploadAssetDto {
  @IsString()
  @MaxLength(200)
  filename!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  contentType!: string;

  @IsString()
  base64Data!: string;
}
