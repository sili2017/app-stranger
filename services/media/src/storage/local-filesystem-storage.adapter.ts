import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageAdapter } from './storage-adapter.interface';

/**
 * ADQ-005 (resolved: AWS S3): dev-only fallback implementation of StorageAdapter, used
 * by storage-adapter-factory.ts whenever `STORAGE_DRIVER` isn't `s3`. Every domain
 * service and the Media service's own endpoints depend only on StorageAdapter, never on
 * this class directly, so it stays swappable via the factory alone.
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

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  private resolve(key: string): string {
    return path.join(this.baseDir, key);
  }
}
