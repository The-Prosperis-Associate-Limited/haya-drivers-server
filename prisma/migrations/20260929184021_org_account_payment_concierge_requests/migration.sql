-- CreateEnum
CREATE TYPE "HirePackage" AS ENUM ('PRIVATE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('WEEKDAYS', 'WEEKDAYS_AND_SATURDAY', 'FULL_WEEK', 'CUSTOM');

-- AlterEnum
ALTER TYPE "HireInvoiceStatus" ADD VALUE 'PAYMENT_REVIEW';

-- AlterEnum
ALTER TYPE "HireRequestStatus" ADD VALUE 'PAYMENT_REVIEW';

-- AlterTable
ALTER TABLE "HireInvoice" ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "proof_note" TEXT,
ADD COLUMN     "proof_rejected_reason" TEXT,
ADD COLUMN     "proof_submitted_at" TIMESTAMP(3),
ADD COLUMN     "proof_url" TEXT;

-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "closing_time" TEXT,
ADD COLUMN     "driver_type" "DriverType",
ADD COLUMN     "drivers_needed" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "duration_months" INTEGER,
ADD COLUMN     "insurance_cover" TEXT,
ADD COLUMN     "nearest_area" TEXT,
ADD COLUMN     "package" "HirePackage" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "provides_accommodation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resumption_time" TEXT,
ADD COLUMN     "schedule" "WorkSchedule" NOT NULL DEFAULT 'WEEKDAYS',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "transmission" "Transmission",
ALTER COLUMN "driverId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "HireInvoice" ADD CONSTRAINT "HireInvoice_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
