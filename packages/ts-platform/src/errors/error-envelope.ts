/**
 * Standard error envelope shape from contracts/api-standards.md §Standard Error Format.
 * `code` is the stable, machine-readable identifier clients branch on; `messageKey` is a
 * translation key (never pre-rendered English — ADR-004) resolved client-side.
 */
export interface ErrorEnvelope {
  error: {
    code: string;
    messageKey: string;
    correlationId: string;
    details: ErrorDetail[];
  };
}

export interface ErrorDetail {
  field: string;
  issue: string;
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly httpStatus: number,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(code);
    this.name = 'DomainError';
  }
}

export function buildErrorEnvelope(err: DomainError, correlationId: string): ErrorEnvelope {
  return {
    error: {
      code: err.code,
      messageKey: err.messageKey,
      correlationId,
      details: err.details,
    },
  };
}
