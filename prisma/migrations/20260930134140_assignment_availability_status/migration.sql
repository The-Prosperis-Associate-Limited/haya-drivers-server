-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "HireAssignment" ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "status" "AvailabilityStatus" NOT NULL DEFAULT 'PENDING';
