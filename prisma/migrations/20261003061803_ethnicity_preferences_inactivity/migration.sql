-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "ethnicity" TEXT;

-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "preferred_age_range" TEXT,
ADD COLUMN     "preferred_ethnicity" TEXT,
ADD COLUMN     "preferred_religion" TEXT;

-- AlterTable
ALTER TABLE "StaffingRequest" ADD COLUMN     "preferred_age_range" TEXT,
ADD COLUMN     "preferred_ethnicity" TEXT,
ADD COLUMN     "preferred_religion" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivated_for_inactivity" BOOLEAN NOT NULL DEFAULT false;
