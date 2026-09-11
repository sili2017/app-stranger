import { Injectable } from '@nestjs/common';

@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly offerBaseUrl = process.env.OFFER_BASE_URL ?? 'http://localhost:3002';
  private readonly participationBaseUrl =
    process.env.PARTICIPATION_BASE_URL ?? 'http://localhost:3004';

  async getOfferCreator(offerId: string): Promise<string | null> {
    const body = (await this.getWithTimeout(
      `${this.offerBaseUrl}/internal/v1/offers/${offerId}/status`,
    )) as { creatorUserId?: string };
    return body?.creatorUserId ?? null;
  }

  async getSelectionRecipient(selectionId: string): Promise<string | null> {
    const body = (await this.getWithTimeout(
      `${this.participationBaseUrl}/internal/v1/participation/selections/${selectionId}`,
    )) as { recipientUserId?: string };
    return body?.recipientUserId ?? null;
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
