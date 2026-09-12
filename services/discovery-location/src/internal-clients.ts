import { Injectable } from '@nestjs/common';

/** Convergence T126 (FR-015): block-enforcement check against Trust & Safety. */
@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly trustSafetyBaseUrl =
    process.env.TRUST_SAFETY_BASE_URL ?? 'http://localhost:3006';

  async isBlocked(userId: string, otherUserId: string): Promise<boolean> {
    const res = (await this.getWithTimeout(
      `${this.trustSafetyBaseUrl}/internal/v1/trust-safety/blocks/check?userId=${encodeURIComponent(userId)}&otherUserId=${encodeURIComponent(otherUserId)}`,
    )) as { blocked?: boolean };
    return res?.blocked === true;
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
}
