-- CreateEnum
CREATE TYPE "SalaryPaymentStatus" AS ENUM ('DUE', 'PAID', 'CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SalaryDisputeResolution" AS ENUM ('PAID', 'UNPAID');

-- CreateTable
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "SalaryPaymentStatus" NOT NULL DEFAULT 'DUE',
    "paid_at" TIMESTAMP(3),
    "receipt_url" TEXT,
    "client_note" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "disputed_at" TIMESTAMP(3),
    "dispute_reason" TEXT,
    "resolution" "SalaryDisputeResolution",
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "last_reminded_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryPayment_status_due_at_idx" ON "SalaryPayment"("status", "due_at");

-- CreateIndex
CREATE INDEX "SalaryPayment_driverId_paid_at_idx" ON "SalaryPayment"("driverId", "paid_at");

-- CreateIndex
CREATE INDEX "SalaryPayment_clientId_status_idx" ON "SalaryPayment"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_bookingId_period_start_key" ON "SalaryPayment"("bookingId", "period_start");

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Brokered bookings get the end date their hire request already implied.
UPDATE "Booking" b
SET "ends_at" = CASE
    WHEN h."engagement_type" = 'CONTRACT' AND h."duration_days" IS NOT NULL THEN b."starts_at" + make_interval(days => h."duration_days")
    WHEN h."engagement_type" = 'MONTHLY' AND h."duration_months" IS NOT NULL THEN b."starts_at" + make_interval(months => h."duration_months")
  END
FROM "HireAssignment" a
JOIN "HireRequest" h ON h."id" = a."hireRequestId"
WHERE a."driverId" = b."driverId"
  AND h."clientId" = b."clientId"
  AND h."status" = 'PAID'
  AND h."starts_at" = b."starts_at"
  AND b."ends_at" IS NULL;
