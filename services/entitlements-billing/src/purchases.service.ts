import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from './prisma.service';
import { BillingEventsProducer } from './events/billing-events.producer';
import { createPaymentVerifier } from './payment-webhook/payment-provider-factory';
import { ONE_TIME_BROADCAST_REFERENCE_PRICE_MINOR, REFERENCE_CURRENCY } from './pricing';

/** T104: the USD-1-equivalent one-time broadcast purchase (FR-035). */
@Injectable()
export class PurchasesService {
  private readonly verifier = createPaymentVerifier();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: BillingEventsProducer,
  ) {}

  async purchase(userId: string, receiptToken: string, correlationId: string) {
    const verification = await this.verifier.verifyReceipt(receiptToken);
    if (!verification.valid) {
      throw new DomainError(
        'PAYMENT_VERIFICATION_FAILED',
        'errors.paymentVerificationFailed',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const purchase = await this.prisma.$transaction(async (tx) => {
      const row = await tx.oneTimeBroadcastPurchase.create({
        data: {
          userId,
          priceMinor: ONE_TIME_BROADCAST_REFERENCE_PRICE_MINOR,
          currency: REFERENCE_CURRENCY,
          status: 'granted',
        },
      });
      await this.events.oneTimeBroadcastGranted(
        tx as unknown as PrismaService,
        { userId, purchaseId: row.id, priceMinor: row.priceMinor, currency: row.currency },
        correlationId,
      );
      return row;
    });

    return purchase;
  }
}
