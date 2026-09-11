import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IsString } from 'class-validator';
import { PrismaService } from '../prisma.service';
import { encryptContactHandle, decryptContactHandle } from './encryption';

class SetTrustedContactDto {
  @IsString()
  contactHandle!: string;
}

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}

@Controller('trusted-contacts')
export class TrustedContactsController {
  constructor(private readonly prisma: PrismaService) {}

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
}
