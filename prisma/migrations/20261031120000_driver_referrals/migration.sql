-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('SIGNED_UP', 'REWARDED', 'HELD', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReferralChannel" AS ENUM ('SIGNUP', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "AccountSignalEvent" AS ENUM ('SIGNUP', 'LOGIN', 'SUBMIT', 'REFERRAL_ATTACH');

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'REFERRAL_BONUS';

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'REFERRAL_ATTACHED';
ALTER TYPE "ActivityType" ADD VALUE 'REFERRAL_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'REFERRAL_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'REFERRAL_REVERSED';

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "referral_code" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" "ReferralChannel" NOT NULL DEFAULT 'SIGNUP',
    "status" "ReferralStatus" NOT NULL DEFAULT 'SIGNED_UP',
    "reward_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "walletTransactionId" TEXT,
    "reversalTransactionId" TEXT,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualified_at" TIMESTAMP(3),
    "rewarded_at" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "AccountSignalEvent" NOT NULL,
    "ip_hash" TEXT,
    "device_hash" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_walletTransactionId_key" ON "Referral"("walletTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_reversalTransactionId_key" ON "Referral"("reversalTransactionId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccountSignal_userId_createdAt_idx" ON "AccountSignal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountSignal_ip_hash_createdAt_idx" ON "AccountSignal"("ip_hash", "createdAt");

-- CreateIndex
CREATE INDEX "AccountSignal_device_hash_idx" ON "AccountSignal"("device_hash");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_referral_code_key" ON "DriverProfile"("referral_code");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_reversalTransactionId_fkey" FOREIGN KEY ("reversalTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSignal" ADD CONSTRAINT "AccountSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

