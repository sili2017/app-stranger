import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { FREE_MONTHLY_ALLOWANCE, currentCalendarMonthKey } from './pricing';

export type AuthorizeDecision =
  | {
      decision: 'granted';
      entitlementSource: 'subscription' | 'one_time_purchase' | 'free_allowance';
    }
  | { decision: 'rejected' };

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * T099: replaces the Foundational always-granted stub (T039) — Offer's call site
   * (`POST /internal/v1/entitlements/authorize`) is unchanged. Order: an active
   * subscription bypasses the free allowance entirely (FR-032); otherwise the free
   * monthly allowance is preferred over consuming a paid one-time purchase (FR-030,
   * FR-031); only once both are exhausted is a one-time purchase consumed (FR-035).
   * Every successful publish — regardless of source — increments the ledger and it is
   * never decremented, matching FR-030's resolved "no refund on stop/expire, rebroadcast
   * counts again" rule.
   */
  async authorize(userId: string, offerId: string): Promise<AuthorizeDecision> {
    const activeSubscription = await this.findActiveSubscription(userId);
    if (activeSubscription) {
      await this.recordLedgerEntry(userId, offerId, 'subscription');
      return { decision: 'granted', entitlementSource: 'subscription' };
    }

    const monthKey = currentCalendarMonthKey();
    const ledger = await this.prisma.publishingEntitlementLedger.upsert({
      where: { userId_calendarMonthKey: { userId, calendarMonthKey: monthKey } },
      create: { userId, calendarMonthKey: monthKey, freeOffersUsedThisMonth: 0 },
      update: {},
    });

    if (ledger.freeOffersUsedThisMonth < FREE_MONTHLY_ALLOWANCE) {
      await this.prisma.$transaction([
        this.prisma.publishingEntitlementLedger.update({
          where: { id: ledger.id },
          data: { freeOffersUsedThisMonth: { increment: 1 } },
        }),
      ]);
      await this.recordLedgerEntry(userId, offerId, 'free_allowance');
      return { decision: 'granted', entitlementSource: 'free_allowance' };
    }

    const availablePurchase = await this.prisma.oneTimeBroadcastPurchase.findFirst({
      where: { userId, status: 'granted' },
      orderBy: { createdAt: 'asc' },
    });
    if (availablePurchase) {
      await this.prisma.oneTimeBroadcastPurchase.update({
        where: { id: availablePurchase.id },
        data: { status: 'consumed', consumedByOfferId: offerId },
      });
      await this.recordLedgerEntry(userId, offerId, 'one_time_purchase');
      return { decision: 'granted', entitlementSource: 'one_time_purchase' };
    }

    return { decision: 'rejected' };
  }

  /** T102: GET /api/v1/entitlements — remaining allowance + subscription state (FR-031, FR-034). */
  async getEntitlementStatus(userId: string) {
    const monthKey = currentCalendarMonthKey();
    const ledger = await this.prisma.publishingEntitlementLedger.findUnique({
      where: { userId_calendarMonthKey: { userId, calendarMonthKey: monthKey } },
    });
    const usedThisMonth = ledger?.freeOffersUsedThisMonth ?? 0;
    const subscription = await this.findActiveSubscription(userId);
    const availablePurchases = await this.prisma.oneTimeBroadcastPurchase.count({
      where: { userId, status: 'granted' },
    });

    return {
      remainingFreeAllowanceThisMonth: subscription
        ? null
        : Math.max(0, FREE_MONTHLY_ALLOWANCE - usedThisMonth),
      hasActiveSubscription: !!subscription,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      availableOneTimePurchases: availablePurchases,
    };
  }

  private async findActiveSubscription(userId: string) {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'cancelled_pending_period_end'] },
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });
  }

  private async recordLedgerEntry(
    userId: string,
    offerId: string,
    entitlementSource: 'subscription' | 'one_time_purchase' | 'free_allowance',
  ) {
    await this.prisma.entitlementLedgerEntry.create({
      data: { userId, offerId, entitlementSource },
    });
  }
}
