import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { InternalClients } from './internal-clients';

/**
 * Internal-only contract (`/internal/v1/...`) — never exposed through the gateway.
 * Authorization here is service-identity-based per contracts/api-standards.md
 * §Internal Service Contract Rules: a resource-owning service (Offer) always re-checks
 * authorization itself rather than trusting the caller's forwarded userId blindly.
 */
@Controller('internal/v1/offers')
export class InternalOffersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: InternalClients,
  ) {}

  /** Status/capacity revalidation at write time (T071, T073) — never a cached read. */
  @Get(':id/status')
  async status(@Param('id') id: string) {
    const offer = await this.prisma.meetOffer.findUnique({ where: { id } });
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    return { status: offer.status, capacity: offer.capacity, creatorUserId: offer.creatorUserId };
  }

  /**
   * T081: the exact place (incl. rendezvousInstruction) — scoped to the offer's creator
   * or a caller with an accepted Selection on this offer, never cached beyond the
   * request, never republished onto the event bus (contracts/events.md offer.published).
   */
  @Get(':id/place')
  async place(@Param('id') id: string, @Query('callerUserId') callerUserId: string) {
    const offer = await this.prisma.meetOffer.findUnique({ where: { id } });
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }

    const isCreator = offer.creatorUserId === callerUserId;
    const isSelected = isCreator
      ? true
      : await this.internal.hasAcceptedSelection(id, callerUserId);
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
}
