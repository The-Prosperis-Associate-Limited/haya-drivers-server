import { Router } from "express";
import { AdminAttendanceController } from "../../controllers/admin/admin.attendance.controller";

const adminAttendanceRouter = Router();
const attendance = new AdminAttendanceController();

adminAttendanceRouter.get("/flags", attendance.listFlags);
adminAttendanceRouter.post("/flags/:id/resolve", attendance.resolveFlag);
adminAttendanceRouter.get("/bookings/:reference", attendance.bookingLog);

export { adminAttendanceRouter };
