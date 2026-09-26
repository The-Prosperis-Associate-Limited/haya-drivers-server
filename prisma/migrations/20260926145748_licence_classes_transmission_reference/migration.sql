/*
  Warnings:

  - You are about to drop the column `vehicle_classes` on the `DriverProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LicenceClass" AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'MANUAL', 'BOTH');

-- AlterTable
ALTER TABLE "DriverProfile" DROP COLUMN "vehicle_classes",
ADD COLUMN     "licence_classes" "LicenceClass"[],
ADD COLUMN     "transmission" "Transmission";

-- DropEnum
DROP TYPE "VehicleClass";

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "company_name" TEXT,
    "phone_no" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reference_driverId_key" ON "Reference"("driverId");

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
