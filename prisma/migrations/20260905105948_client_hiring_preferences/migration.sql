-- CreateEnum
CREATE TYPE "ClientDriverCategory" AS ENUM ('CONTRACT', 'PRIVATE', 'CORPORATE', 'EXECUTIVE', 'SPY', 'EXPATRIATE');

-- CreateEnum
CREATE TYPE "DriversNeededRange" AS ENUM ('ONE', 'TWO_TO_FIVE', 'SIX_TO_FIFTEEN', 'SIXTEEN_PLUS');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "HiringTimeline" AS ENUM ('IMMEDIATELY', 'WITHIN_TWO_WEEKS', 'THIS_MONTH', 'EXPLORING');

-- CreateEnum
CREATE TYPE "BudgetRange" AS ENUM ('RANGE_150_200K', 'RANGE_201_250K', 'RANGE_251_300K', 'RANGE_301K_PLUS');

-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "assignment_type" "AssignmentType",
ADD COLUMN     "budget_range" "BudgetRange",
ADD COLUMN     "drivers_needed" "DriversNeededRange",
ADD COLUMN     "hiring_categories" "ClientDriverCategory"[] DEFAULT ARRAY[]::"ClientDriverCategory"[],
ADD COLUMN     "hiring_timeline" "HiringTimeline",
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "primary_location" TEXT;
