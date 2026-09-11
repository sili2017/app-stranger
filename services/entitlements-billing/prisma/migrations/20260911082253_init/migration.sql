-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('free_allowance', 'one_time_purchase', 'subscription');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled_pending_period_end', 'expired');

-- CreateEnum
CREATE TYPE "OneTimeBroadcastPurchaseStatus" AS ENUM ('granted', 'consumed');

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "producedBy" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingEntitlementLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarMonthKey" TEXT NOT NULL,
    "freeOffersUsedThisMonth" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PublishingEntitlementLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "entitlementSource" "EntitlementSource" NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "basePriceMinor" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeBroadcastPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "OneTimeBroadcastPurchaseStatus" NOT NULL DEFAULT 'granted',
    "consumedByOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeBroadcastPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingEntitlementLedger_userId_calendarMonthKey_key" ON "PublishingEntitlementLedger"("userId", "calendarMonthKey");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementLedgerEntry_offerId_key" ON "EntitlementLedgerEntry"("offerId");

-- CreateIndex
CREATE INDEX "EntitlementLedgerEntry_userId_idx" ON "EntitlementLedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "OneTimeBroadcastPurchase_userId_status_idx" ON "OneTimeBroadcastPurchase"("userId", "status");
