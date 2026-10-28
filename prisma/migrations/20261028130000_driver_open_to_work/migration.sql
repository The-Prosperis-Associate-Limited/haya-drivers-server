-- AlterTable: every existing driver is backfilled as open to work, so nobody drops out of search
ALTER TABLE "DriverProfile" ADD COLUMN "open_to_work" BOOLEAN NOT NULL DEFAULT true;
