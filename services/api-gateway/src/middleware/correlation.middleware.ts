import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

/**
 * Assigns/propagates a correlation id on every request (contracts/api-standards.md
 * §Internal Service Contract Rules: "the correlation id from the originating client
 * request ... propagates through every internal call") and reads Accept-Language so
 * downstream services can resolve messageKeys/out-of-band templates to the caller's
 * language without changing the error-response body itself (ADR-004).
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuid();
    (req as any).correlationId = correlationId;
    (req as any).acceptLanguage = req.headers['accept-language'] ?? 'en';
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
