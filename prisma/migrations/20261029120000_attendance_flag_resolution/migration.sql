-- CreateEnum
CREATE TYPE "AttendanceFlagResolution" AS ENUM ('UPHELD', 'DISMISSED');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "flag_resolution" "AttendanceFlagResolution",
ADD COLUMN     "flag_resolution_note" TEXT,
ADD COLUMN     "flag_resolved_at" TIMESTAMP(3),
ADD COLUMN     "flag_resolved_by" TEXT;

-- CreateIndex
CREATE INDEX "Attendance_flagged_at_flag_resolved_at_idx" ON "Attendance"("flagged_at", "flag_resolved_at");

