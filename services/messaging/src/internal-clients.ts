import { Injectable } from '@nestjs/common';

@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly offerBaseUrl = process.env.OFFER_BASE_URL ?? 'http://localhost:3002';
  private readonly trustSafetyBaseUrl =
    process.env.TRUST_SAFETY_BASE_URL ?? 'http://localhost:3006';

  async getOfferCreator(offerId: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.offerBaseUrl}/internal/v1/offers/${offerId}/status`, {
        signal: controller.signal,
      });
      const body = (await response.json()) as { creatorUserId?: string };
      return body.creatorUserId ?? null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Convergence T126 (FR-015): block-enforcement check against Trust & Safety. */
  async isBlocked(userId: string, otherUserId: string): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.trustSafetyBaseUrl}/internal/v1/trust-safety/blocks/check?userId=${encodeURIComponent(userId)}&otherUserId=${encodeURIComponent(otherUserId)}`,
        { signal: controller.signal },
      );
      const body = (await response.json()) as { blocked?: boolean };
      return body.blocked === true;
    } finally {
      clearTimeout(timer);
    }
  }
}
