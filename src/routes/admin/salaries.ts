import { Router } from "express";
import { AdminSalariesController } from "../../controllers/admin/admin.salaries.controller";

const adminSalariesRouter = Router();
const salaries = new AdminSalariesController();

adminSalariesRouter.get("/", salaries.list);
adminSalariesRouter.post("/:id/resolve", salaries.resolve);
adminSalariesRouter.get("/bookings/:reference", salaries.bookingLog);

export { adminSalariesRouter };
