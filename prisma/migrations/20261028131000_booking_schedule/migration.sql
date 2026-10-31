-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "schedule" "WorkSchedule",
ADD COLUMN "resumption_time" TEXT,
ADD COLUMN "closing_time" TEXT;

-- Backfill: payment confirmation created one booking per assigned driver from the paid request, same client and start date
UPDATE "Booking" AS b
SET "schedule" = h."schedule",
    "resumption_time" = h."resumption_time",
    "closing_time" = h."closing_time"
FROM "HireRequest" AS h
JOIN "HireAssignment" AS a ON a."hireRequestId" = h."id"
WHERE h."status" = 'PAID'
  AND b."clientId" = h."clientId"
  AND b."driverId" = a."driverId"
  AND b."starts_at" = h."starts_at"
  AND b."schedule" IS NULL;
