import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { ParticipationService } from './participation.service';

/** Backs Offer's T081 scoped exact-place lookup authorization check. */
@Controller('internal/v1/participation')
export class InternalParticipationController {
  constructor(private readonly participation: ParticipationService) {}

  @Get('offers/:offerId/accepted-selection')
  async hasAcceptedSelection(@Param('offerId') offerId: string, @Query('userId') userId: string) {
    const hasAcceptedSelection = await this.participation.hasAcceptedSelection(offerId, userId);
    return { hasAcceptedSelection };
  }

  /** Backs Trust & Safety's T085 lazy participant resolution for the rating follow-up. */
  @Get('selections/:selectionId')
  async getSelection(@Param('selectionId') selectionId: string) {
    const selection = await this.participation.getSelection(selectionId);
    if (!selection) {
      throw new DomainError(
        'SELECTION_NOT_FOUND',
        'errors.selectionNotFound',
        HttpStatus.NOT_FOUND,
      );
    }
    return { offerId: selection.offerId, recipientUserId: selection.recipientUserId };
  }
}
