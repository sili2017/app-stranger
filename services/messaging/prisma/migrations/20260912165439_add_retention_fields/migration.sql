-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "legalHold" BOOLEAN NOT NULL DEFAULT false;
