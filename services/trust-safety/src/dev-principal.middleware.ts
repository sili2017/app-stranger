import { Request, Response, NextFunction } from 'express';

/** Local-testing convenience only — see services/offer/src/dev-principal.middleware.ts. */
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
