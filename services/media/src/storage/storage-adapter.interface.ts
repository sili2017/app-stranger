export interface StorageAdapter {
  put(key: string, contents: Buffer, contentType: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Feature 25: reads an object's bytes back — backs GET /assets/:id/content. */
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
