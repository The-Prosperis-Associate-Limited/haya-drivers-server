-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[];
