import { Injectable } from '@nestjs/common';
import { OutboxRepository, OutboxRow } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchUnpublished(limit: number): Promise<OutboxRow[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      eventType: row.eventType,
      aggregateId: row.aggregateId,
      aggregateVersion: row.aggregateVersion,
      correlationId: row.correlationId,
      causationId: row.causationId,
      producedBy: row.producedBy,
      schemaVersion: row.schemaVersion,
      data: row.data as Record<string, unknown>,
      occurredAt: row.occurredAt,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }
}
