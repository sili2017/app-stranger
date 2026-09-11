-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('live_gps', 'last_known');

-- CreateEnum
CREATE TYPE "EligibilityOfferStatus" AS ENUM ('active', 'stopped', 'expired');

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
CREATE TABLE "LocationSnapshot" (
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "source" "LocationSource" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CityInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryEligibility" (
    "offerId" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "placeGeohash" TEXT NOT NULL,
    "placeKind" TEXT NOT NULL,
    "activityText" TEXT NOT NULL,
    "lifetimeMinutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "EligibilityOfferStatus" NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "interestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DiscoveryEligibility_pkey" PRIMARY KEY ("offerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- CreateIndex
CREATE INDEX "CityInterest_userId_idx" ON "CityInterest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CityInterest_userId_cityId_key" ON "CityInterest"("userId", "cityId");

-- CreateIndex
CREATE INDEX "DiscoveryEligibility_status_cityId_idx" ON "DiscoveryEligibility"("status", "cityId");
