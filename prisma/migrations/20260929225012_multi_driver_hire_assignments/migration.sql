-- AlterTable
ALTER TABLE "HireInvoice" ADD COLUMN     "per_driver_minor" INTEGER;

-- CreateTable
CREATE TABLE "HireAssignment" (
    "id" TEXT NOT NULL,
    "hireRequestId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HireAssignment_driverId_idx" ON "HireAssignment"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "HireAssignment_hireRequestId_driverId_key" ON "HireAssignment"("hireRequestId", "driverId");

-- AddForeignKey
ALTER TABLE "HireAssignment" ADD CONSTRAINT "HireAssignment_hireRequestId_fkey" FOREIGN KEY ("hireRequestId") REFERENCES "HireRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireAssignment" ADD CONSTRAINT "HireAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
