import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { OffersService } from './offers.service';
import { PublishOfferDto } from './dto';

/**
 * T050 (rebroadcast half). Per spec.md Clarifications (2026-09-11): rebroadcasting
 * pre-fills a new offer from the prior offer's details for the creator to review/edit,
 * then confirming captures a new place/GPS snapshot at that moment (FR-002's
 * single-snapshot rule) and goes through the exact same publish pipeline as any other
 * offer — same screening, same entitlement check, same monthly-allowance counting
 * (FR-030) — so it is always a genuinely new `MeetOffer` row, never a reactivation of
 * the old one.
 */
@Injectable()
export class RebroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly offers: OffersService,
  ) {}

  /** Returns the prior offer's fields as a pre-filled draft for the client to edit. */
  async getDraft(offerId: string, callerUserId: string) {
    const prior = await this.prisma.meetOffer.findUnique({ where: { id: offerId } });
    if (!prior) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    if (prior.creatorUserId !== callerUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    return {
      activityText: prior.activityText,
      place: {
        kind: prior.placeKind,
        label: prior.placeLabel ?? undefined,
        lat: prior.placeLat,
        lng: prior.placeLng,
        rendezvousInstruction: prior.rendezvousInstruction ?? undefined,
      },
      lifetimeMinutes: prior.lifetimeMinutes,
      capacity: prior.capacity,
      cityId: prior.cityId,
      moneyPreference: prior.moneyPreferenceLabel
        ? { label: prior.moneyPreferenceLabel, note: prior.moneyPreferenceNote ?? undefined }
        : undefined,
    };
  }

  /** Confirms the (possibly edited) draft, creating a brand-new MeetOffer. */
  async confirm(
    offerId: string,
    callerUserId: string,
    dto: PublishOfferDto,
    correlationId: string,
  ) {
    const prior = await this.prisma.meetOffer.findUnique({ where: { id: offerId } });
    if (!prior) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    if (prior.creatorUserId !== callerUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }

    const created = await this.offers.publish(callerUserId, dto, correlationId);
    await this.prisma.meetOffer.update({
      where: { id: created.id },
      data: { rebroadcastOfOfferId: offerId },
    });
    return created;
  }
}
