import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageAdapter } from '../../src/storage/s3-storage.adapter';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3StorageAdapter', () => {
  const bucket = 'test-bucket';
  let send: jest.Mock;
  let client: S3Client;
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn().mockResolvedValue(undefined);
    client = { send } as unknown as S3Client;
    adapter = new S3StorageAdapter(bucket, client);
  });

  it('put() sends a PutObjectCommand with the right params', async () => {
    const contents = Buffer.from('hello');
    await adapter.put('users/1/photo.jpg', contents, 'image/jpeg');

    expect(send).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: 'users/1/photo.jpg',
      Body: contents,
      ContentType: 'image/jpeg',
    });
  });

  it('delete() sends a DeleteObjectCommand with the right key', async () => {
    await adapter.delete('users/1/photo.jpg');

    expect(send).toHaveBeenCalledTimes(1);
    expect(DeleteObjectCommand).toHaveBeenCalledWith({ Bucket: bucket, Key: 'users/1/photo.jpg' });
  });

  it('getSignedUrl() calls the presigner with the right params and returns its result', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.example.com/photo.jpg');

    const url = await adapter.getSignedUrl('users/1/photo.jpg', 300);

    expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: bucket, Key: 'users/1/photo.jpg' });
    expect(getSignedUrl).toHaveBeenCalledWith(client, expect.any(GetObjectCommand), {
      expiresIn: 300,
    });
    expect(url).toBe('https://signed.example.com/photo.jpg');
  });

  it('get() sends a GetObjectCommand and buffers the streamed body (Feature 25)', async () => {
    async function* body() {
      yield Buffer.from('hel');
      yield Buffer.from('lo');
    }
    send.mockResolvedValue({ Body: body() });

    const bytes = await adapter.get('users/1/photo.jpg');

    expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: bucket, Key: 'users/1/photo.jpg' });
    expect(bytes).toEqual(Buffer.from('hello'));
  });
});
