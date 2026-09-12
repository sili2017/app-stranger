-- CreateEnum
CREATE TYPE "ScreeningAppealStatus" AS ENUM ('submitted', 'upheld', 'denied');

-- CreateTable
CREATE TABLE "ScreeningAppeal" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ScreeningAppealStatus" NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ScreeningAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningAppeal_status_idx" ON "ScreeningAppeal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningAppeal_offerId_creatorUserId_key" ON "ScreeningAppeal"("offerId", "creatorUserId");
