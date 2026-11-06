ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'VERIFICATION_PAUSED';

ALTER TABLE "DriverProfile" ADD COLUMN "documents_due_at" TIMESTAMP(3),
ADD COLUMN "documents_notice_sent_at" TIMESTAMP(3);

-- Verified drivers missing a required document (the CV, added 6 Nov 2026) get 14 days from deploy to upload it.
UPDATE "DriverProfile" p
SET "documents_due_at" = NOW() + INTERVAL '14 days'
WHERE p."verification_status" = 'APPROVED'
  AND (
    SELECT COUNT(DISTINCT d."type")
    FROM "DriverDocument" d
    WHERE d."userId" = p."userId"
      AND d."type"::text IN ('NIN_SLIP', 'PASSPORT_PHOTO', 'DRIVERS_LICENCE', 'PROOF_OF_ADDRESS', 'GUARANTOR_PASSPORT', 'GUARANTOR_NIN_SLIP', 'CV')
  ) < 7;
