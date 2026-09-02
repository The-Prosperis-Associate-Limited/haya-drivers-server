-- AlterTable
ALTER TABLE "ModuleProgress" ADD COLUMN     "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duration_seconds" INTEGER;
