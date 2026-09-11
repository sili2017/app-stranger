import * as Sentry from '@sentry/node';
import { redact } from './redaction';

/**
 * Initializes Sentry with a beforeSend hook that applies the same redaction rule as
 * StructuredLogger (constitution §5, §7) — a captured exception's extra/context data
 * never leaks a Highly Restricted or Restricted field.
 */
export function initSentry(serviceName: string, dsn: string | undefined): void {
  if (!dsn) {
    // No DSN configured (e.g. local dev) — skip silently rather than failing startup.
    return;
  }
  Sentry.init({
    dsn,
    serverName: serviceName,
    beforeSend(event) {
      if (event.extra) {
        event.extra = redact(event.extra as Record<string, unknown>);
      }
      if (event.contexts) {
        event.contexts = redact(event.contexts) as typeof event.contexts;
      }
      return event;
    },
  });
}
