import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * [BLOCKED: ADQ-005] Dev-only AES-256-GCM encryption for TrustedContactSetting's
 * Highly Restricted contactHandle (data-model.md: "encrypted at rest"). The key is
 * derived from an env var with a static salt — acceptable for local development only.
 * Production key management (rotation, KMS/HSM-backed storage) is an open decision
 * tied to the same object-storage/encryption approval as ADQ-005; swap this module for
 * the approved implementation without changing any caller, since both expose the same
 * encrypt/decrypt shape.
 */
const KEY = scryptSync(
  process.env.TRUSTED_CONTACT_ENC_KEY ?? 'dev-only-not-for-production',
  'stranger-salt',
  32,
);

export function encryptContactHandle(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptContactHandle(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
