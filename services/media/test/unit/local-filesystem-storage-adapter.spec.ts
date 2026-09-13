import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalFilesystemStorageAdapter } from '../../src/storage/local-filesystem-storage.adapter';

describe('LocalFilesystemStorageAdapter', () => {
  let baseDir: string;
  let adapter: LocalFilesystemStorageAdapter;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-storage-test-'));
    adapter = new LocalFilesystemStorageAdapter(baseDir);
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('put() then get() round-trips the exact bytes (Feature 25)', async () => {
    const contents = Buffer.from('profile photo bytes');
    await adapter.put('users/1/photo.jpg', contents, 'image/jpeg');

    const bytes = await adapter.get('users/1/photo.jpg');

    expect(bytes).toEqual(contents);
  });

  it('delete() removes the file so a later get() rejects', async () => {
    await adapter.put('users/1/photo.jpg', Buffer.from('x'), 'image/jpeg');
    await adapter.delete('users/1/photo.jpg');

    await expect(adapter.get('users/1/photo.jpg')).rejects.toThrow();
  });
});
