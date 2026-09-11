import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** T109: writes to AuditLogEntry — separate from ordinary application logs (constitution §7). */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorUserId: string,
    action: string,
    subjectType: string,
    subjectId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLogEntry.create({
      data: { actorUserId, action, subjectType, subjectId, details: details as any },
    });
  }
}
