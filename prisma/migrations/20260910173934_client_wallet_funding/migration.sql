/*
  Warnings:

  - A unique constraint covering the columns `[dva_customer_code]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'FUNDING';
ALTER TYPE "WalletTransactionType" ADD VALUE 'BOOKING_CHARGE';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "dva_account_name" TEXT,
ADD COLUMN     "dva_account_number" TEXT,
ADD COLUMN     "dva_bank_name" TEXT,
ADD COLUMN     "dva_customer_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_dva_customer_code_key" ON "Wallet"("dva_customer_code");
