import { Body, Controller, Get, HttpStatus, Post, Put, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IsString } from 'class-validator';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';
import { InternalClients } from '../rating/internal-clients';
import { encryptContactHandle, decryptContactHandle } from './encryption';

class SetTrustedContactDto {
  @IsString()
  contactHandle!: string;
}

/** Convergence T132 (FR-015, Clarifications Session 2026-09-12 round 2). */
class ShareMeetupDto {
  @IsString()
  offerId!: string;
}

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}

@Controller('trusted-contacts')
export class TrustedContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: InternalClients,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async get(@Req() req: Request) {
    const row = await this.prisma.trustedContactSetting.findUnique({
      where: { userId: principal(req) },
    });
    if (!row) return null;
    // Decrypted only for the owning user's own read of their own setting — never in a
    // list/discovery response (data-model.md).
    return {
      contactHandle: decryptContactHandle(row.contactHandleEncrypted),
      updatedAt: row.updatedAt,
    };
  }

  @Put()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async set(@Body() dto: SetTrustedContactDto, @Req() req: Request) {
    const userId = principal(req);
    const contactHandleEncrypted = encryptContactHandle(dto.contactHandle);
    await this.prisma.trustedContactSetting.upsert({
      where: { userId },
      create: { userId, contactHandleEncrypted },
      update: { contactHandleEncrypted },
    });
    return { saved: true };
  }

  /**
   * Convergence T132 (FR-015, Clarifications Session 2026-09-12 round 2): a manual,
   * one-tap share — not automatic or continuous. Returns the decrypted contact handle
   * and a preformatted message for the client to hand off via its own share sheet
   * (SMS/WhatsApp/email/etc.) — no SMS/email provider is integrated anywhere in this
   * codebase, and picking/paying for one is a vendor decision outside this task's
   * scope, so the client's native share mechanism is the right-sized v1 delivery path.
   */
  @Post('share')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async share(@Body() dto: ShareMeetupDto, @Req() req: Request) {
    const userId = principal(req);
    const setting = await this.prisma.trustedContactSetting.findUnique({ where: { userId } });
    if (!setting) {
      throw new DomainError(
        'NO_TRUSTED_CONTACT',
        'errors.noTrustedContact',
        HttpStatus.CONFLICT,
      );
    }

    const place = await this.internal.getExactPlace(dto.offerId, userId);
    if (!place) {
      throw new DomainError('OFFER_NOT_FOUND', 'errors.offerNotFound', HttpStatus.NOT_FOUND);
    }

    const where = place.label ?? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
    const message =
      `I'm meeting for "${place.activityText}" at ${where}` +
      (place.rendezvousInstruction ? ` (${place.rendezvousInstruction})` : '') +
      ` until ${place.expiresAt}. Sent via Stranger's safety sharing.`;

    return {
      contactHandle: decryptContactHandle(setting.contactHandleEncrypted),
      message,
    };
  }
}
