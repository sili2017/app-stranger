import { randomUUID } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { OfferEventsProducer } from '../events/offer-events.producer';
import { InternalClients } from './internal-clients';
import { encodeGeohash } from './geohash';
import { PublishOfferDto } from './dto';

const DEFAULT_LIFETIME_MINUTES = 15;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OfferEventsProducer,
    private readonly internal: InternalClients,
  ) {}

  /**
   * T045: validate -> screen (FR-039) -> authorize entitlement -> persist `active` +
   * outbox event, all in one transaction so a downstream failure never leaves a
   * screened-but-unpersisted offer or a reserved-but-unused entitlement.
   */
  async publish(creatorUserId: string, dto: PublishOfferDto, correlationId: string) {
    this.validatePlace(dto);

    const screening = await this.internal.screenOffer(dto.activityText);
    if (!screening.passed) {
      throw new DomainError(
        'CONTENT_SCREENING_FAILED',
        'errors.contentScreeningFailed',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Reserve a tentative offer id up front so authorize can be checked against it,
    // matching contracts/public/offer-service.md's "screen -> authorize -> persist" order.
    const offerId = randomUUID();
    const authorize = await this.internal.authorizeEntitlement(creatorUserId, offerId);
    if (authorize.decision !== 'granted') {
      throw new DomainError(
        'ENTITLEMENT_REQUIRED',
        'errors.entitlementRequired',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const lifetimeMinutes = dto.lifetimeMinutes ?? DEFAULT_LIFETIME_MINUTES;
    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + lifetimeMinutes * 60_000);
    const placeGeohash = encodeGeohash(dto.place.lat, dto.place.lng);

    const offer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.meetOffer.create({
        data: {
          id: offerId,
          creatorUserId,
          cityId: dto.cityId ?? 'unknown',
          activityText: dto.activityText,
          placeKind: dto.place.kind,
          placeLabel: dto.place.label,
          placeLat: dto.place.lat,
          placeLng: dto.place.lng,
          placeGeohash,
          rendezvousInstruction: dto.place.rendezvousInstruction,
          lifetimeMinutes,
          capacity: dto.capacity,
          status: 'active',
          publishedAt,
          expiresAt,
          interestCount: 0,
          screeningPassed: screening.passed,
          screeningRuleVersion: screening.ruleVersion,
          screeningEvaluatedAt: new Date(screening.evaluatedAt),
          moneyPreferenceLabel: dto.moneyPreference?.label,
          moneyPreferenceNote: dto.moneyPreference?.note,
          moneyPreferenceNoteModerationStatus: dto.moneyPreference?.note ? 'pending' : null,
          suggestionActivityKey: dto.suggestionActivityKey,
          suggestionEmoji: dto.suggestionEmoji,
        },
      });

      await this.events.offerPublished(
        tx as unknown as PrismaService,
        {
          id: created.id,
          creatorUserId: created.creatorUserId,
          cityId: created.cityId,
          placeGeohash: created.placeGeohash,
          placeKind: created.placeKind,
          activityText: created.activityText,
          lifetimeMinutes: created.lifetimeMinutes,
          capacity: created.capacity,
          publishedAt: created.publishedAt,
          expiresAt: created.expiresAt,
        },
        correlationId,
      );

      return created;
    });

    return offer;
  }

  /** T048: creator-only, active -> stopped, rejects if already inactive (FR-011). */
  async stop(offerId: string, callerUserId: string, correlationId: string) {
    const offer = await this.prisma.meetOffer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    if (offer.creatorUserId !== callerUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    if (offer.status !== 'active') {
      throw new DomainError('OFFER_NOT_ACTIVE', 'errors.offerNotActive', HttpStatus.CONFLICT);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.meetOffer.update({
        where: { id: offerId },
        data: { status: 'stopped' },
      });
      await this.events.offerStoppedOrExpired(
        tx as unknown as PrismaService,
        offerId,
        'stopped',
        correlationId,
      );
      return row;
    });
    return updated;
  }

  /** T049: interestCount live while active (FR-042). */
  async getById(offerId: string) {
    const offer = await this.prisma.meetOffer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    return offer;
  }

  /** T050 (history half): creator-visible past-offer history (FR-012). */
  async listForCreator(creatorUserId: string) {
    return this.prisma.meetOffer.findMany({
      where: { creatorUserId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Public, user-authenticated counterpart to `internal.controller.ts`'s
   * `/internal/v1/offers/:id/place` (T081) — that route is service-identity-scoped
   * (contracts/api-standards.md §Internal Service Contract Rules) and was never meant to
   * be called directly by a client, but nothing else exposed this to a real caller at
   * all, which made "the creator/selected recipient sees the exact place" (FR-002)
   * unreachable from any actual client. Reuses the exact same authorization check.
   */
  async getExactPlace(offerId: string, callerUserId: string) {
    const offer = await this.prisma.meetOffer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }

    const isCreator = offer.creatorUserId === callerUserId;
    const isSelected = isCreator
      ? true
      : await this.internal.hasAcceptedSelection(offerId, callerUserId);
    if (!isCreator && !isSelected) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }

    return {
      kind: offer.placeKind,
      label: offer.placeLabel,
      lat: offer.placeLat,
      lng: offer.placeLng,
      rendezvousInstruction: offer.rendezvousInstruction,
    };
  }

  private validatePlace(dto: PublishOfferDto) {
    const requiresRendezvous =
      dto.place.kind === 'moving' || dto.isQueueStyleWithoutFixedVenue === true;
    if (requiresRendezvous && !dto.place.rendezvousInstruction) {
      throw new DomainError(
        'RENDEZVOUS_INSTRUCTION_REQUIRED',
        'errors.rendezvousInstructionRequired',
        HttpStatus.BAD_REQUEST,
        [{ field: 'place.rendezvousInstruction', issue: 'REQUIRED' }],
      );
    }
  }
}
