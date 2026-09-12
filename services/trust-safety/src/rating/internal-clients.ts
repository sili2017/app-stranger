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

  /** Convergence T128: verifies caller/status before accepting a screening appeal. */
  async getOfferStatus(
    offerId: string,
  ): Promise<{ status: string; creatorUserId: string } | null> {
    const body = (await this.getWithTimeout(
      `${this.offerBaseUrl}/internal/v1/offers/${offerId}/status`,
    )) as { status?: string; creatorUserId?: string };
    if (!body?.status || !body?.creatorUserId) return null;
    return { status: body.status, creatorUserId: body.creatorUserId };
  }

  /**
   * Convergence T132: the exact place for the trusted-contact share message — reuses
   * Offer's own creator-or-accepted-recipient authorization, never a new access path.
   */
  async getExactPlace(
    offerId: string,
    callerUserId: string,
  ): Promise<{
    label: string | null;
    lat: number;
    lng: number;
    rendezvousInstruction: string | null;
    activityText: string;
    expiresAt: string;
  } | null> {
    const body = (await this.getWithTimeout(
      `${this.offerBaseUrl}/internal/v1/offers/${offerId}/place?callerUserId=${encodeURIComponent(callerUserId)}`,
    )) as Record<string, unknown> & { error?: unknown };
    if (!body || body.error || typeof body.activityText !== 'string') return null;
    return body as any;
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
