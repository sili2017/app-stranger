import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decodeGeohash } from './geohash';
import { haversineKm, toDistanceBand, DistanceBand } from './distance';
import { eligibilityRadiusKm } from './eligibility-radius';

/** FR-005 (resolved via /speckit-clarify): a last-known location is usable for up to 10 minutes. */
const LAST_KNOWN_STALENESS_MS = 10 * 60 * 1000;

export interface EligibleOffer {
  offerId: string;
  cityId: string;
  placeKind: string;
  activityText: string;
  capacity: number;
  interestCount: number;
  publishedAt: Date;
  expiresAt: Date;
  distanceKm: number;
  distanceBand: DistanceBand;
}

export interface FeedFilters {
  activity?: string;
  distanceBand?: DistanceBand;
  /** Minimum minutes remaining before expiry (time-remaining filter, FR-022). */
  minMinutesRemaining?: number;
}

@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * T060: recipient is eligible when offer.status == active AND recipient has a
   * matching CityInterest AND distance(recipient, offer) <= eligibilityRadiusKm[cityId]
   * (FR-004, resolved via /speckit-clarify).
   *
   * T061: ranking prioritizes the recipient's current location (spec.md Clarifications,
   * FR-005, FR-023) — implemented as ascending distance from the recipient's current
   * LocationSnapshot, since eligibility itself is per-offer proximity and no city-label
   * source for "the recipient's current city" is approved yet (spec.md Assumptions:
   * city-label normalization is unresolved). Nearest-first inherently ranks an offer
   * matching where the recipient currently is above one that is only reachable via a
   * registered-but-distant city interest, without inventing an unapproved city-matching
   * rule.
   */
  async listEligibleForRecipient(
    recipientUserId: string,
    filters: FeedFilters = {},
  ): Promise<EligibleOffer[]> {
    const location = await this.prisma.locationSnapshot.findUnique({
      where: { userId: recipientUserId },
    });
    if (!location) {
      return [];
    }
    // Edge case (spec.md): a stale last-known location must never be treated as
    // "nearby" — proximity-based eligibility is skipped entirely once stale, rather
    // than silently ranking on outdated data.
    const isStale =
      location.source === 'last_known' &&
      Date.now() - location.capturedAt.getTime() > LAST_KNOWN_STALENESS_MS;
    if (isStale) {
      return [];
    }

    const cityInterests = await this.prisma.cityInterest.findMany({
      where: { userId: recipientUserId },
    });
    const interestedCityIds = new Set(cityInterests.map((c) => c.cityId));
    if (interestedCityIds.size === 0) {
      return [];
    }

    const candidates = await this.prisma.discoveryEligibility.findMany({
      where: {
        status: 'active',
        cityId: { in: [...interestedCityIds] },
        ...(filters.activity
          ? { activityText: { contains: filters.activity, mode: 'insensitive' } }
          : {}),
      },
    });

    const now = Date.now();
    const results: EligibleOffer[] = [];

    for (const offer of candidates) {
      const offerPoint = decodeGeohash(offer.placeGeohash);
      const distanceKm = haversineKm(location, offerPoint);
      if (distanceKm > eligibilityRadiusKm(offer.cityId)) continue;

      const distanceBand = toDistanceBand(distanceKm);
      if (filters.distanceBand && filters.distanceBand !== distanceBand) continue;

      const minutesRemaining = Math.max(0, (offer.expiresAt.getTime() - now) / 60_000);
      if (filters.minMinutesRemaining && minutesRemaining < filters.minMinutesRemaining) continue;

      results.push({
        offerId: offer.offerId,
        cityId: offer.cityId,
        placeKind: offer.placeKind,
        activityText: offer.activityText,
        capacity: offer.capacity,
        interestCount: offer.interestCount,
        publishedAt: offer.publishedAt,
        expiresAt: offer.expiresAt,
        distanceKm,
        distanceBand,
      });
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /**
   * Used by Participation's internal write-time eligibility check (contracts/public/
   * offer-service.md: "Participation calls Discovery & Location's internal contract to
   * confirm eligibility at write time, not just at read time"). Reuses the same rule as
   * listEligibleForRecipient rather than a separate, potentially-drifting check.
   */
  async isEligible(recipientUserId: string, offerId: string): Promise<boolean> {
    const eligible = await this.listEligibleForRecipient(recipientUserId);
    return eligible.some((offer) => offer.offerId === offerId);
  }
}
