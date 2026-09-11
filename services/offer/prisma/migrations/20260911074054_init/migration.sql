-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('pin', 'venue', 'live', 'moving');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('active', 'expired', 'stopped');

-- CreateEnum
CREATE TYPE "MoneyPreferenceLabel" AS ENUM ('creator_pays', 'byo', 'split', 'estimated_cost');

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
CREATE TABLE "MeetOffer" (
    "id" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "activityText" TEXT NOT NULL,
    "placeKind" "PlaceKind" NOT NULL,
    "placeLabel" TEXT,
    "placeLat" DOUBLE PRECISION NOT NULL,
    "placeLng" DOUBLE PRECISION NOT NULL,
    "placeGeohash" TEXT NOT NULL,
    "rendezvousInstruction" TEXT,
    "placeCapturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifetimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "capacity" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "interestCount" INTEGER NOT NULL DEFAULT 0,
    "screeningPassed" BOOLEAN NOT NULL,
    "screeningRuleVersion" TEXT NOT NULL,
    "screeningEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "moneyPreferenceLabel" "MoneyPreferenceLabel",
    "moneyPreferenceNote" TEXT,
    "moneyPreferenceNoteModerationStatus" TEXT DEFAULT 'pending',
    "suggestionActivityKey" TEXT,
    "suggestionEmoji" TEXT,
    "rebroadcastOfOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- CreateIndex
CREATE INDEX "MeetOffer_status_idx" ON "MeetOffer"("status");

-- CreateIndex
CREATE INDEX "MeetOffer_creatorUserId_idx" ON "MeetOffer"("creatorUserId");
