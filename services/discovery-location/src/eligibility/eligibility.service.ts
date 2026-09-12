import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decodeGeohash } from './geohash';
import { haversineKm, toDistanceBand, DistanceBand } from './distance';
import { eligibilityRadiusKm } from './eligibility-radius';
import { InternalClients } from '../internal-clients';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: InternalClients,
  ) {}

  /**
   * T060: recipient is eligible when offer.status == active AND
   * distance(recipient, offer) <= eligibilityRadiusKm[cityId] (FR-004, resolved via
   * /speckit-clarify). A registered CityInterest narrows this to just those cities —
   * but only when at least one is registered; with none, every active city is in play
   * (see the fallback note below listEligibleForRecipient's cityFilter), since FR-023's
   * point is prioritizing a user's chosen cities, not gatekeeping ones they never chose.
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
    // Real gap found via manual testing: a user who never registered a city interest
    // saw an empty feed forever, even standing right next to an active offer — city
    // interests were being enforced as a strict allow-list rather than the "prioritize
    // these" preference FR-023 actually describes. With none registered, fall back to
    // every active offer, still gated by the same per-city radius and still ranked
    // nearest-first below — a registered interest still matters (it's what lets a
    // *distant* city's offers appear at all), it just no longer blocks a *nearby* one
    // with no city interest behind it.
    const cityFilter = interestedCityIds.size > 0 ? { cityId: { in: [...interestedCityIds] } } : {};

    const candidates = await this.prisma.discoveryEligibility.findMany({
      where: {
        status: 'active',
        ...cityFilter,
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

      // Convergence T126 (FR-015): a blocked creator's offers never appear in the
      // recipient's feed, regardless of distance/city eligibility.
      if (await this.internal.isBlocked(recipientUserId, offer.creatorUserId)) continue;

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

  /**
   * Convergence T125 (FR-006): the reverse direction of listEligibleForRecipient —
   * given one offer, which recipients are eligible for it right now. Used by
   * Notification to fan out "a new offer is nearby" within ~30s of publish, per
   * contracts/events.md's offer.published contract (Notification is a named consumer).
   * Reuses the exact same eligibility rule (distance + city-interest fallback) as the
   * recipient-facing feed so the two directions can never drift apart. Every candidate
   * user's own LocationSnapshot/CityInterest state is checked in application code
   * (no PostGIS in this environment), matching the existing scale posture of this v1
   * codebase (ADQ-007 capacity targets are still open).
   */
  async listEligibleRecipientsForOffer(offerId: string): Promise<string[]> {
    const offer = await this.prisma.discoveryEligibility.findUnique({ where: { offerId } });
    if (!offer || offer.status !== 'active') {
      return [];
    }

    const offerPoint = decodeGeohash(offer.placeGeohash);
    const radiusKm = eligibilityRadiusKm(offer.cityId);
    const candidates = await this.prisma.locationSnapshot.findMany();

    const now = Date.now();
    const eligibleUserIds: string[] = [];

    for (const location of candidates) {
      if (location.userId === offer.creatorUserId) continue;

      const isStale =
        location.source === 'last_known' &&
        now - location.capturedAt.getTime() > LAST_KNOWN_STALENESS_MS;
      if (isStale) continue;

      const distanceKm = haversineKm(location, offerPoint);
      if (distanceKm > radiusKm) continue;

      const cityInterests = await this.prisma.cityInterest.findMany({
        where: { userId: location.userId },
      });
      const hasAnyInterest = cityInterests.length > 0;
      const matchesThisCity = cityInterests.some((c) => c.cityId === offer.cityId);
      // Mirrors listEligibleForRecipient's fallback: a registered interest narrows to
      // that set of cities, but with none registered every active city is in play.
      if (hasAnyInterest && !matchesThisCity) continue;

      // Convergence T126 (FR-015): don't push-notify a recipient blocked with the creator.
      if (await this.internal.isBlocked(location.userId, offer.creatorUserId)) continue;

      eligibleUserIds.push(location.userId);
    }

    return eligibleUserIds;
  }
}
