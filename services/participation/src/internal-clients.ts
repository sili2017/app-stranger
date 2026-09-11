import { Injectable } from '@nestjs/common';

@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly offerBaseUrl = process.env.OFFER_BASE_URL ?? 'http://localhost:3002';
  private readonly discoveryBaseUrl = process.env.DISCOVERY_BASE_URL ?? 'http://localhost:3003';

  /** T071/T073: live status/capacity revalidation — never a cached read. */
  async getOfferStatus(offerId: string): Promise<{
    status: 'active' | 'expired' | 'stopped';
    capacity: number;
    creatorUserId: string;
  } | null> {
    const res = await this.getWithTimeout(
      `${this.offerBaseUrl}/internal/v1/offers/${offerId}/status`,
    );
    if (res && typeof res === 'object' && 'error' in (res as any)) return null;
    return res as any;
  }

  /**
   * T071: confirms eligibility at write time via Discovery & Location's internal
   * contract — closes the race edge case named in contracts/public/offer-service.md.
   */
  async isEligibleRecipient(offerId: string, recipientUserId: string): Promise<boolean> {
    const res = (await this.getWithTimeout(
      `${this.discoveryBaseUrl}/internal/v1/discovery/eligibility?offerId=${encodeURIComponent(offerId)}&recipientUserId=${encodeURIComponent(recipientUserId)}`,
    )) as { eligible: boolean };
    return res?.eligible === true;
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
