import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { DomainError, buildErrorEnvelope } from './error-envelope';

/**
 * Global Nest exception filter enforcing contracts/api-standards.md's error shape on
 * every response. A DomainError maps to its declared httpStatus; anything else becomes
 * a generic 500 rather than leaking an internal stack/message to the client.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const correlationId: string = request?.correlationId ?? 'unknown';

    if (exception instanceof DomainError) {
      response.status(exception.httpStatus).json(buildErrorEnvelope(exception, correlationId));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const domainError = new DomainError(
        httpStatusToGenericCode(status),
        'errors.generic',
        status,
      );
      response.status(status).json(buildErrorEnvelope(domainError, correlationId));
      return;
    }

    // An unexpected (non-DomainError, non-HttpException) exception must still be
    // logged somewhere — the client only ever sees the generic envelope below, never
    // the real error, so without this the failure would be operationally invisible
    // (contracts/api-standards.md §Logging & Audit: every request/response logged with
    // a correlation id).
    // eslint-disable-next-line no-console
    console.error(`[${correlationId}] Unhandled exception:`, exception);

    const fallback = new DomainError(
      'INTERNAL_ERROR',
      'errors.internal',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(buildErrorEnvelope(fallback, correlationId));
  }
}

function httpStatusToGenericCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'UNAUTHORIZED';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}
