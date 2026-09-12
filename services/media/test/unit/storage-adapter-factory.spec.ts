import { createStorageAdapter } from '../../src/storage/storage-adapter-factory';
import { LocalFilesystemStorageAdapter } from '../../src/storage/local-filesystem-storage.adapter';
import { S3StorageAdapter } from '../../src/storage/s3-storage.adapter';

jest.mock('@aws-sdk/client-s3');

describe('createStorageAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STORAGE_DRIVER;
    delete process.env.S3_BUCKET;
    delete process.env.AWS_REGION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns LocalFilesystemStorageAdapter when STORAGE_DRIVER is unset', () => {
    const adapter = createStorageAdapter();

    expect(adapter).toBeInstanceOf(LocalFilesystemStorageAdapter);
  });

  it('returns an S3-backed adapter when STORAGE_DRIVER=s3 and S3_BUCKET is set', () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_BUCKET = 'my-bucket';

    const adapter = createStorageAdapter();

    expect(adapter).toBeInstanceOf(S3StorageAdapter);
  });

  it('throws when STORAGE_DRIVER=s3 but S3_BUCKET is unset', () => {
    process.env.STORAGE_DRIVER = 's3';

    expect(() => createStorageAdapter()).toThrow(/S3_BUCKET/);
  });
});
