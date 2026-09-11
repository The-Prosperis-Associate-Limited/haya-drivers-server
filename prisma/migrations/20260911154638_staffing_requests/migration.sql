-- CreateEnum
CREATE TYPE "StaffingRequestStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequestApplicationStatus" AS ENUM ('APPLIED', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "StaffingRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "driver_type" "DriverType" NOT NULL,
    "engagement_type" "EngagementType" NOT NULL DEFAULT 'MONTHLY',
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT,
    "budget" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "StaffingRequestStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestApplication" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "RequestApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffingRequest_reference_key" ON "StaffingRequest"("reference");

-- CreateIndex
CREATE INDEX "StaffingRequest_clientId_status_createdAt_idx" ON "StaffingRequest"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffingRequest_status_state_driver_type_idx" ON "StaffingRequest"("status", "state", "driver_type");

-- CreateIndex
CREATE INDEX "RequestApplication_requestId_status_idx" ON "RequestApplication"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequestApplication_requestId_driverId_key" ON "RequestApplication"("requestId", "driverId");

-- AddForeignKey
ALTER TABLE "StaffingRequest" ADD CONSTRAINT "StaffingRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestApplication" ADD CONSTRAINT "RequestApplication_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestApplication" ADD CONSTRAINT "RequestApplication_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
