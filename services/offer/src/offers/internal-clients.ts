import { Injectable } from '@nestjs/common';

/**
 * Synchronous internal calls per contracts/api-standards.md §Internal Service Contract
 * Rules: mandatory timeout, no retry unless the target is documented idempotent. Both
 * targets here are pure decision endpoints (screen / authorize), so a timeout without
 * retry is the correct default — a retry on `authorize` could double-reserve without an
 * Idempotency-Key, which this internal call intentionally doesn't carry yet (tracked as
 * a gap in checklists/api.md CHK008/CHK023).
 */
@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly trustSafetyBaseUrl =
    process.env.TRUST_SAFETY_BASE_URL ?? 'http://localhost:3006';
  private readonly entitlementsBaseUrl =
    process.env.ENTITLEMENTS_BASE_URL ?? 'http://localhost:3007';
  private readonly participationBaseUrl =
    process.env.PARTICIPATION_BASE_URL ?? 'http://localhost:3004';

  async screenOffer(activityText: string): Promise<{
    passed: boolean;
    ruleVersion: string;
    evaluatedAt: string;
  }> {
    const res = await this.fetchWithTimeout(
      `${this.trustSafetyBaseUrl}/internal/v1/trust-safety/screen-offer`,
      { activityText },
    );
    return res as any;
  }

  async authorizeEntitlement(
    userId: string,
    offerId: string,
  ): Promise<{ decision: 'granted' | 'rejected'; entitlementSource: string }> {
    const res = await this.fetchWithTimeout(
      `${this.entitlementsBaseUrl}/internal/v1/entitlements/authorize`,
      { userId, offerId },
    );
    return res as any;
  }

  /** T081: authorization check for the scoped exact-place lookup. */
  async hasAcceptedSelection(offerId: string, userId: string): Promise<boolean> {
    const res = (await this.getWithTimeout(
      `${this.participationBaseUrl}/internal/v1/participation/offers/${offerId}/accepted-selection?userId=${encodeURIComponent(userId)}`,
    )) as { hasAcceptedSelection: boolean };
    return res.hasAcceptedSelection === true;
  }

  private async getWithTimeout(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchWithTimeout(url: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
