import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageAdapter } from './storage-adapter.interface';

/**
 * ADQ-005 (resolved: AWS S3): production StorageAdapter. Reads and writes go through
 * IAM-scoped requests to the bucket rather than public ACLs, and delivery URLs are
 * short-lived presigned GETs (never a public object URL) — this bucket also holds
 * government-ID verification images, so access must stay time-limited and auditable
 * per ADR-010, not merely "unlisted".
 */
export class S3StorageAdapter implements StorageAdapter {
  constructor(
    private readonly bucket: string,
    private readonly client: S3Client,
  ) {}

  async put(key: string, contents: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: contents, ContentType: contentType }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
