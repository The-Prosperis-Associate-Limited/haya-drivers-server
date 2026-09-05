-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "availability" JSONB,
ADD COLUMN     "expected_monthly_rate" INTEGER,
ADD COLUMN     "rate_currency" TEXT NOT NULL DEFAULT 'NGN';
