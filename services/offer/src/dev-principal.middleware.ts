import { Request, Response, NextFunction } from 'express';

/**
 * Local-testing convenience only: standing in for the gateway's real verified-principal
 * forwarding (contracts/api-standards.md §Authentication & Authorization) since the
 * gateway does not yet proxy requests to domain services (only scaffolded per T017-T020).
 * Reads `x-dev-user-id` directly — NEVER wire this into a production path.
 */
export function devPrincipalMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const devUserId = req.headers['x-dev-user-id'];
  if (devUserId) {
    (req as any).verifiedPrincipal = {
      userId: String(devUserId),
      ageAssuranceStatus: 'liveness_passed',
      roles: [],
    };
  }
  (req as any).correlationId = req.headers['x-correlation-id'] ?? 'dev-local';
  next();
}
