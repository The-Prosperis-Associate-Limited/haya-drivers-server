-- CreateEnum
CREATE TYPE "HireRequestStatus" AS ENUM ('PENDING_REVIEW', 'INVOICED', 'PAID', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HireInvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'VOID');

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'VAT_CHARGE';

-- CreateTable
CREATE TABLE "HireRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "engagement_type" "EngagementType" NOT NULL DEFAULT 'MONTHLY',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "HireRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "declined_reason" TEXT,
    "declined_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HireRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireInvoice" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "hireRequestId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "vat_percent" DOUBLE PRECISION NOT NULL,
    "vat_minor" INTEGER NOT NULL,
    "fee_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "HireInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "note" TEXT,
    "paid_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HireInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HireRequest_reference_key" ON "HireRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "HireRequest_bookingId_key" ON "HireRequest"("bookingId");

-- CreateIndex
CREATE INDEX "HireRequest_status_createdAt_idx" ON "HireRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HireRequest_clientId_createdAt_idx" ON "HireRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "HireRequest_driverId_createdAt_idx" ON "HireRequest"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HireInvoice_reference_key" ON "HireInvoice"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "HireInvoice_hireRequestId_key" ON "HireInvoice"("hireRequestId");

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireInvoice" ADD CONSTRAINT "HireInvoice_hireRequestId_fkey" FOREIGN KEY ("hireRequestId") REFERENCES "HireRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireInvoice" ADD CONSTRAINT "HireInvoice_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
