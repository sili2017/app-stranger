import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageAdapter } from './storage-adapter.interface';

/**
 * [BLOCKED: ADQ-005] Local dev-only implementation of StorageAdapter, standing in for
 * the eventual S3-compatible provider (research.md §6). Every domain service and the
 * Media service's own endpoints depend only on StorageAdapter, never on this class, so
 * swapping in the approved provider is a single binding change (constitution §5).
 *
 * MUST NOT be used in production: no encryption-at-rest, no access audit, no regional
 * residency control — the properties research.md §6 requires of the real provider.
 */
export class LocalFilesystemStorageAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string) {}

  async put(key: string, contents: Buffer, _contentType: string): Promise<void> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents);
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    // Dev-only stand-in for a signed URL: a local file:// reference, never exposed
    // publicly. Real provider returns a time-limited HTTPS URL.
    return `file://${this.resolve(key)}`;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  private resolve(key: string): string {
    return path.join(this.baseDir, key);
  }
}
