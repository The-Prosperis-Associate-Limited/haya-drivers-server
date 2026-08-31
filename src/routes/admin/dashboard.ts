import { Router } from "express";
import { AdminDashboardController } from "../../controllers/admin/admin.dashboard.controller";

const adminDashboardRouter = Router();
const dashboard = new AdminDashboardController();

adminDashboardRouter.get("/stats", dashboard.stats);
adminDashboardRouter.get("/activities", dashboard.activities);

export { adminDashboardRouter };
