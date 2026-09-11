-- CreateEnum
CREATE TYPE "RatingVisibility" AS ENUM ('pending_followup', 'public', 'removed');

-- CreateEnum
CREATE TYPE "BlockStatus" AS ENUM ('pending_review', 'enforced', 'rejected');

-- CreateEnum
CREATE TYPE "ReportSubjectType" AS ENUM ('user', 'offer', 'message', 'rating_feedback', 'photo');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending_review', 'enforced', 'rejected');

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
CREATE TABLE "RatingPrompt" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "creatorUserId" TEXT,
    "recipientUserId" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "scheduledSendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "RatingPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingFeedback" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "raterUserId" TEXT NOT NULL,
    "rateeUserId" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "writtenFeedback" TEXT,
    "photoAssetId" TEXT,
    "photoConsent" JSONB NOT NULL DEFAULT '[]',
    "visibility" "RatingVisibility" NOT NULL DEFAULT 'pending_followup',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicAt" TIMESTAMP(3),

    CONSTRAINT "RatingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "status" "BlockStatus" NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "subjectType" "ReportSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedContactSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactHandleEncrypted" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedContactSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RatingPrompt_selectionId_key" ON "RatingPrompt"("selectionId");

-- CreateIndex
CREATE INDEX "RatingPrompt_scheduledSendAt_sentAt_idx" ON "RatingPrompt"("scheduledSendAt", "sentAt");

-- CreateIndex
CREATE INDEX "RatingFeedback_rateeUserId_visibility_idx" ON "RatingFeedback"("rateeUserId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "RatingFeedback_selectionId_raterUserId_key" ON "RatingFeedback"("selectionId", "raterUserId");

-- CreateIndex
CREATE INDEX "Block_sourceUserId_idx" ON "Block"("sourceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_sourceUserId_targetUserId_key" ON "Block"("sourceUserId", "targetUserId");

-- CreateIndex
CREATE INDEX "Report_reporterUserId_idx" ON "Report"("reporterUserId");

-- CreateIndex
CREATE INDEX "Report_subjectType_subjectId_idx" ON "Report"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedContactSetting_userId_key" ON "TrustedContactSetting"("userId");
