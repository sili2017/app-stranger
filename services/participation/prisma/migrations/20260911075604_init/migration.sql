-- CreateEnum
CREATE TYPE "SelectionOutcome" AS ENUM ('pending', 'happened', 'cancelled');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('creator', 'recipient');

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
CREATE TABLE "ExpressionOfInterest" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpressionOfInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "expressionOfInterestId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "SelectionOutcome" NOT NULL DEFAULT 'pending',
    "cancelledBy" "CancelledBy",
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- CreateIndex
CREATE INDEX "ExpressionOfInterest_offerId_idx" ON "ExpressionOfInterest"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpressionOfInterest_offerId_recipientUserId_key" ON "ExpressionOfInterest"("offerId", "recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_expressionOfInterestId_key" ON "Selection"("expressionOfInterestId");

-- CreateIndex
CREATE INDEX "Selection_offerId_idx" ON "Selection"("offerId");

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_expressionOfInterestId_fkey" FOREIGN KEY ("expressionOfInterestId") REFERENCES "ExpressionOfInterest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
