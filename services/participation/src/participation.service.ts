import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from './prisma.service';
import { ParticipationEventsProducer } from './events/participation-events.producer';
import { InternalClients } from './internal-clients';

@Injectable()
export class ParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ParticipationEventsProducer,
    private readonly internal: InternalClients,
  ) {}

  /**
   * T071: revalidates the offer is still active AND the recipient is still eligible at
   * write time (not a cached read) before recording — closes the "offer expires while a
   * recipient is submitting" edge case (spec.md Edge Cases).
   */
  async expressInterest(
    offerId: string,
    recipientUserId: string,
    message: string | undefined,
    correlationId: string,
  ) {
    const offer = await this.internal.getOfferStatus(offerId);
    if (!offer || offer.status !== 'active') {
      throw new DomainError('OFFER_NOT_ACTIVE', 'errors.offerNotActive', HttpStatus.CONFLICT);
    }

    // Item 32: a creator can't express interest in their own offer. Discovery &
    // Location's eligibility rule already excludes a creator from their own offer's
    // candidate pool (belt), but that's a separate service call — this check keeps the
    // rule enforced here too (suspenders) rather than relying solely on that call never
    // drifting or being bypassed.
    if (offer.creatorUserId === recipientUserId) {
      throw new DomainError('NOT_ELIGIBLE', 'errors.notEligible', HttpStatus.FORBIDDEN);
    }

    const eligible = await this.internal.isEligibleRecipient(offerId, recipientUserId);
    if (!eligible) {
      throw new DomainError('NOT_ELIGIBLE', 'errors.notEligible', HttpStatus.FORBIDDEN);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.expressionOfInterest.findUnique({
        where: { offerId_recipientUserId: { offerId, recipientUserId } },
      });
      const row =
        existing ??
        (await tx.expressionOfInterest.create({ data: { offerId, recipientUserId, message } }));
      // A retried request is idempotent by (offerId, recipientUserId) — only emit the
      // domain event on genuine creation, not on a no-op replay, or interestCount (Offer,
      // Discovery & Location) and the creator's notification both double up per retry.
      if (!existing) {
        await this.events.interestExpressed(
          tx as unknown as PrismaService,
          { offerId, expressionOfInterestId: row.id, recipientUserId, hasMessage: !!message },
          correlationId,
        );
      }
      return row;
    });

    return created;
  }

  /**
   * T073: creator-only, revalidates offer status + capacity remaining at write time;
   * `expressionOfInterestId` is never swappable once accepted (Clarifications).
   */
  async select(
    offerId: string,
    callerUserId: string,
    expressionOfInterestId: string,
    correlationId: string,
  ) {
    const offer = await this.internal.getOfferStatus(offerId);
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    if (offer.creatorUserId !== callerUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    if (offer.status !== 'active') {
      throw new DomainError('OFFER_NOT_ACTIVE', 'errors.offerNotActive', HttpStatus.CONFLICT);
    }

    const eoi = await this.prisma.expressionOfInterest.findUnique({
      where: { id: expressionOfInterestId },
      include: { selection: true },
    });
    if (!eoi || eoi.offerId !== offerId) {
      throw new DomainError(
        'EXPRESSION_OF_INTEREST_NOT_FOUND',
        'errors.expressionOfInterestNotFound',
        HttpStatus.NOT_FOUND,
      );
    }
    if (eoi.selection) {
      // Retried request for an already-selected EOI is idempotent, not an error.
      return eoi.selection;
    }

    // Convergence T126 (FR-015): a block since the expression of interest was
    // submitted (in either direction) blocks a new selection, even though the EOI
    // itself already exists.
    if (await this.internal.isBlocked(callerUserId, eoi.recipientUserId)) {
      throw new DomainError('NOT_ELIGIBLE', 'errors.notEligible', HttpStatus.FORBIDDEN);
    }

    const activeSelectionCount = await this.prisma.selection.count({
      where: { offerId, outcome: { not: 'cancelled' } },
    });
    if (activeSelectionCount >= offer.capacity) {
      throw new DomainError('CAPACITY_REACHED', 'errors.capacityReached', HttpStatus.CONFLICT);
    }

    const selection = await this.prisma.$transaction(async (tx) => {
      const row = await tx.selection.create({
        data: {
          offerId,
          expressionOfInterestId,
          recipientUserId: eoi.recipientUserId,
          outcome: 'pending',
        },
      });
      await this.events.participantSelected(
        tx as unknown as PrismaService,
        {
          offerId,
          selectionId: row.id,
          expressionOfInterestId,
          recipientUserId: eoi.recipientUserId,
          selectedAt: row.selectedAt,
        },
        correlationId,
      );
      return row;
    });

    return selection;
  }

  /**
   * Creator-only listing backing `GET /offers/:offerId/expressions-of-interest`
   * (contracts/public/offer-service.md's own quickstart.md Story 3 step 1: "Creator's
   * GET .../expressions-of-interest lists it") — this is how a real client discovers the
   * `expressionOfInterestId` values it can pass to `POST /selections`; there was
   * previously no way to do that at all short of reading the database directly.
   */
  async listExpressionsOfInterest(offerId: string, callerUserId: string) {
    const offer = await this.internal.getOfferStatus(offerId);
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }
    if (offer.creatorUserId !== callerUserId) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }

    const rows = await this.prisma.expressionOfInterest.findMany({
      where: { offerId },
      include: { selection: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      offerId: row.offerId,
      recipientUserId: row.recipientUserId,
      message: row.message,
      createdAt: row.createdAt,
      selected: !!row.selection && row.selection.outcome !== 'cancelled',
    }));
  }

  /**
   * Backs `GET /offers/:offerId/expressions-of-interest/mine` — lets a recipient learn
   * whether they already expressed interest, independent of any single client session,
   * so a button state (e.g. "Interest sent") survives a screen revisit or app restart.
   */
  async getMyExpressionOfInterest(offerId: string, callerUserId: string) {
    const row = await this.prisma.expressionOfInterest.findUnique({
      where: { offerId_recipientUserId: { offerId, recipientUserId: callerUserId } },
    });
    return { expressed: !!row };
  }

  /**
   * Backs `GET /offers/:offerId/selections/mine` — the minimal lookup a client needs to
   * offer a "rate this meetup" action (Story 4/FR-029): the creator sees every selection
   * on their own offer, a recipient sees only their own. There was previously no public
   * way for a client to discover a `selectionId` to rate at all.
   */
  async listSelectionsVisibleTo(offerId: string, callerUserId: string) {
    const offer = await this.internal.getOfferStatus(offerId);
    if (!offer) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }

    const isCreator = offer.creatorUserId === callerUserId;
    const rows = await this.prisma.selection.findMany({
      where: isCreator ? { offerId } : { offerId, recipientUserId: callerUserId },
      orderBy: { selectedAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      offerId: row.offerId,
      recipientUserId: row.recipientUserId,
      outcome: row.outcome,
    }));
  }

  /**
   * T075: FR-027's zero-selection outcome — called by the offer.expired consumer. A
   * partial selection (some but not all interested recipients chosen) sends no such
   * notice (resolved via /speckit-clarify); this only fires when the offer has zero
   * non-cancelled selections at expiry. Emits participation.offer-expired-without-
   * selection listing every interested recipient — T108's Notification service
   * consumes it to actually dispatch the notice.
   */
  async notifyZeroSelectionIfApplicable(
    offerId: string,
    correlationId: string,
  ): Promise<{ notified: boolean }> {
    const activeSelectionCount = await this.prisma.selection.count({
      where: { offerId, outcome: { not: 'cancelled' } },
    });
    if (activeSelectionCount > 0) {
      return { notified: false };
    }

    const interestedRecipients = await this.prisma.expressionOfInterest.findMany({
      where: { offerId },
      select: { recipientUserId: true },
    });
    if (interestedRecipients.length === 0) {
      return { notified: false };
    }

    await this.events.offerExpiredWithoutSelection(
      this.prisma,
      offerId,
      interestedRecipients.map((r) => r.recipientUserId),
      correlationId,
    );
    return { notified: true };
  }

  /**
   * T079: either party (or the creator revoking, treated identically) can cancel; the
   * associated chat's archival is Messaging's responsibility, triggered by the
   * participation.selection-resolved event this method emits.
   */
  async cancel(offerId: string, selectionId: string, callerUserId: string, correlationId: string) {
    const selection = await this.prisma.selection.findUnique({ where: { id: selectionId } });
    if (!selection || selection.offerId !== offerId) {
      throw new DomainError(
        'SELECTION_NOT_FOUND',
        'errors.selectionNotFound',
        HttpStatus.NOT_FOUND,
      );
    }
    if (selection.outcome !== 'pending') {
      throw new DomainError(
        'SELECTION_NOT_CANCELLABLE',
        'errors.selectionNotCancellable',
        HttpStatus.CONFLICT,
      );
    }

    // Fetched server-side, never trusted from the client, to authorize the "creator" path.
    const offer = await this.internal.getOfferStatus(offerId);
    const isRecipient = callerUserId === selection.recipientUserId;
    const isCreator = !!offer && callerUserId === offer.creatorUserId;
    if (!isRecipient && !isCreator) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    const cancelledBy: 'creator' | 'recipient' = isCreator ? 'creator' : 'recipient';

    const resolvedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.selection.update({
        where: { id: selectionId },
        data: { outcome: 'cancelled', cancelledBy, resolvedAt },
      });
      await this.events.selectionResolved(
        tx as unknown as PrismaService,
        { offerId, selectionId, outcome: 'cancelled', cancelledBy, resolvedAt },
        correlationId,
      );
      return row;
    });

    return updated;
  }

  /** Resolves a selection to "happened" — called once the meetup's outcome is known. */
  async resolveAsHappened(offerId: string, selectionId: string, correlationId: string) {
    const resolvedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.selection.update({
        where: { id: selectionId },
        data: { outcome: 'happened', resolvedAt },
      });
      await this.events.selectionResolved(
        tx as unknown as PrismaService,
        { offerId, selectionId, outcome: 'happened', cancelledBy: null, resolvedAt },
        correlationId,
      );
      return row;
    });
    return updated;
  }

  /** Backs the internal accepted-selection check Offer's T081 place lookup depends on. */
  async hasAcceptedSelection(offerId: string, userId: string): Promise<boolean> {
    const selection = await this.prisma.selection.findFirst({
      where: { offerId, recipientUserId: userId, outcome: { not: 'cancelled' } },
    });
    return !!selection;
  }

  /** Backs Trust & Safety's T085 lazy participant resolution for the rating follow-up. */
  async getSelection(selectionId: string) {
    return this.prisma.selection.findUnique({ where: { id: selectionId } });
  }
}
