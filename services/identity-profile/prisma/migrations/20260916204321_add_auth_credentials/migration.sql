-- CreateEnum
CREATE TYPE "AuthProviderKind" AS ENUM ('dev', 'email', 'google', 'facebook', 'apple');

-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN     "authProvider" "AuthProviderKind" NOT NULL DEFAULT 'dev',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "oauthSubject" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_authProvider_oauthSubject_key" ON "UserAccount"("authProvider", "oauthSubject");
