/**
 * Field-level redaction allowlist enforcing data-model.md's Sensitive-Data
 * Classification in every log line and Sentry event: chat content, verification
 * documents, payment identifiers, and precise coordinates never reach a standard log
 * (constitution §5, §7). Extend this list per-service for that service's own
 * Highly Restricted / Restricted fields — never log a new sensitive field by default.
 */
const REDACTED_FIELD_NAMES = new Set([
  'lat',
  'lng',
  'latitude',
  'longitude',
  'dateOfBirth',
  'body', // Message.body
  'evidenceAssetId',
  'contactHandleEncrypted',
  'storageRef',
  'providerToken',
  'password',
  'accessToken',
  'refreshToken',
]);

export function redact<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => redact(item)) as unknown as T;
  }
  if (!input || typeof input !== 'object') {
    return input;
  }
  const output: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  for (const [key, value] of Object.entries(output)) {
    if (REDACTED_FIELD_NAMES.has(key)) {
      output[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      output[key] = redact(value);
    }
  }
  return output as T;
}
