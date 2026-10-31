-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL,
    "checked_out_at" TIMESTAMP(3),
    "minutes_late" INTEGER,
    "scheduled_day" BOOLEAN NOT NULL DEFAULT true,
    "flagged_at" TIMESTAMP(3),
    "flag_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_driverId_checked_in_at_idx" ON "Attendance"("driverId", "checked_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_bookingId_work_date_key" ON "Attendance"("bookingId", "work_date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

