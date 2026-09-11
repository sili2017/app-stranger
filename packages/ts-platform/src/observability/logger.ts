import { redact } from './redaction';

export interface LogFields {
  correlationId?: string;
  callerId?: string;
  route?: string;
  status?: number;
  latencyMs?: number;
  [key: string]: unknown;
}

/**
 * Structured JSON logger with automatic PII-safe redaction (see redaction.ts). Every
 * service should log requests through this rather than console.log directly, so the
 * redaction rule is enforced uniformly (constitution §5, §7; contracts/api-standards.md
 * §Logging & Audit).
 */
export class StructuredLogger {
  constructor(private readonly serviceName: string) {}

  private write(level: 'info' | 'warn' | 'error', message: string, fields: LogFields = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...redact(fields),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }
}
