-- AlterTable
ALTER TABLE "HireInvoice" ADD COLUMN     "breakdown" JSONB;

-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "duration_days" INTEGER;
