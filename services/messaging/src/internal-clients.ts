import { Injectable } from '@nestjs/common';

@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly offerBaseUrl = process.env.OFFER_BASE_URL ?? 'http://localhost:3002';

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
}
