-- AlterTable
ALTER TABLE "HireAssignment" ADD COLUMN "respond_by" TIMESTAMP(3),
ADD COLUMN "expired_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "HireAssignment_status_respond_by_idx" ON "HireAssignment"("status", "respond_by");

-- Backfill: invitations still waiting get a fresh 24-hour window from today, so nobody expires the moment this ships
UPDATE "HireAssignment" SET "respond_by" = NOW() + INTERVAL '24 hours' WHERE "status" = 'PENDING';
