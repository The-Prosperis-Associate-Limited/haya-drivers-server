-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN "monthly_budget" INTEGER;

-- Backfill: each old range becomes its upper bound in kobo (the open-ended top range its floor)
UPDATE "ClientProfile" SET "monthly_budget" = CASE "budget_range"
  WHEN 'RANGE_150_200K' THEN 20000000
  WHEN 'RANGE_201_250K' THEN 25000000
  WHEN 'RANGE_251_300K' THEN 30000000
  WHEN 'RANGE_301K_PLUS' THEN 30100000
END
WHERE "budget_range" IS NOT NULL;

-- AlterTable
ALTER TABLE "ClientProfile" DROP COLUMN "budget_range";

-- DropEnum
DROP TYPE "BudgetRange";
