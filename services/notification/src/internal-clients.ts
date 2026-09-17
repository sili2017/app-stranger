import { Injectable } from '@nestjs/common';

@Injectable()
export class InternalClients {
  private readonly timeoutMs = 3000;
  private readonly offerBaseUrl = process.env.OFFER_BASE_URL ?? 'http://localhost:3002';
  private readonly participationBaseUrl =
    process.env.PARTICIPATION_BASE_URL ?? 'http://localhost:3004';
  private readonly discoveryBaseUrl = process.env.DISCOVERY_BASE_URL ?? 'http://localhost:3003';
  private readonly identityBaseUrl = process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001';

  async getOfferCreator(offerId: string): Promise<string | null> {
    const body = (await this.getWithTimeout(
      `${this.offerBaseUrl}/internal/v1/offers/${offerId}/status`,
    )) as { creatorUserId?: string };
    return body?.creatorUserId ?? null;
  }

  /** Display name for a notification body — best-effort, falls back to null on any failure. */
  async getUserFirstName(userId: string): Promise<string | null> {
    try {
      const body = (await this.getWithTimeout(`${this.identityBaseUrl}/profiles/${userId}`)) as {
        firstName?: string;
      };
      return body?.firstName ?? null;
    } catch {
      return null;
    }
  }

  /** Convergence T125 (FR-006): recipients eligible for a just-published offer. */
  async getEligibleRecipients(offerId: string): Promise<string[]> {
    const body = (await this.getWithTimeout(
      `${this.discoveryBaseUrl}/internal/v1/discovery/offers/${offerId}/eligible-recipients`,
    )) as { recipientUserIds?: string[] };
    return body?.recipientUserIds ?? [];
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
