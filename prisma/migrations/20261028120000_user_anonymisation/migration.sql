-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'ACCOUNT_ANONYMISED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "anonymised_at" TIMESTAMP(3);
