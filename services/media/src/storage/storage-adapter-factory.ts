import { S3Client } from '@aws-sdk/client-s3';
import { LocalFilesystemStorageAdapter } from './local-filesystem-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageAdapter } from './storage-adapter.interface';

/**
 * Convergence T129: single point of construction for the Media service's StorageAdapter,
 * so the ADQ-005 cutover (local filesystem -> S3) doesn't mean editing AssetsService's
 * `new LocalFilesystemStorageAdapter(...)` directly.
 *
 * Defaults to the local filesystem stand-in when `STORAGE_DRIVER` is unset, so importing
 * this module (e.g. in a unit test) never requires AWS credentials or network access.
 * `STORAGE_DRIVER=s3` + `S3_BUCKET` is how a deployment target opts into the real
 * provider; region comes from `AWS_REGION` (default `us-east-1`). Credentials are never
 * read here — the AWS SDK's default credential provider chain (env vars, shared config,
 * instance/task role, etc.) handles that on its own.
 */
export function createStorageAdapter(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET to be set');
    }
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const client = new S3Client({ region });
    return new S3StorageAdapter(bucket, client);
  }
  return new LocalFilesystemStorageAdapter(
    process.env.MEDIA_STORAGE_DIR ?? '.tooling/media-storage',
  );
}
