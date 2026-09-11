import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { buildDomainEvent } from '@stranger/ts-platform';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BillingEventsProducer {
  /** T106: consumed by Notification to confirm the state change to the user. */
  async subscriptionChanged(
    tx: PrismaService,
    input: {
      userId: string;
      subscriptionId: string;
      plan: string;
      status: string;
      currentPeriodEnd: Date;
    },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'billing.subscription-changed',
      input.subscriptionId,
      { ...input, currentPeriodEnd: input.currentPeriodEnd.toISOString() },
      correlationId,
    );
  }

  async oneTimeBroadcastGranted(
    tx: PrismaService,
    input: { userId: string; purchaseId: string; priceMinor: number; currency: string },
    correlationId: string,
  ): Promise<void> {
    await this.writeOutboxRow(
      tx,
      'billing.one-time-broadcast-granted',
      input.purchaseId,
      { ...input, purchasedAt: new Date().toISOString() },
      correlationId,
    );
  }

  private async writeOutboxRow(
    client: PrismaService,
    eventType: string,
    aggregateId: string,
    data: Record<string, unknown>,
    correlationId: string,
  ): Promise<void> {
    const event = buildDomainEvent(
      {
        eventType,
        aggregateId,
        aggregateVersion: 1,
        correlationId,
        producedBy: 'entitlements-billing',
        data,
      },
      uuid,
    );
    await client.outboxEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        correlationId: event.correlationId,
        causationId: event.causationId,
        producedBy: event.producedBy,
        schemaVersion: event.schemaVersion,
        data: event.data as any,
      },
    });
  }
}
