ALTER TABLE "DriverProfile" ADD COLUMN "last_documents_reminder_at" TIMESTAMP(3),
ADD COLUMN "onboarding_reminders_sent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_onboarding_reminder_at" TIMESTAMP(3);
