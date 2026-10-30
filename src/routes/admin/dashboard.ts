import { Router } from "express";
import { AdminDashboardController } from "../../controllers/admin/admin.dashboard.controller";

const adminDashboardRouter = Router();
const dashboard = new AdminDashboardController();

adminDashboardRouter.get("/stats", dashboard.stats);
adminDashboardRouter.get("/nav", dashboard.nav);
adminDashboardRouter.get("/overview", dashboard.overview);
adminDashboardRouter.get("/growth", dashboard.growth);
adminDashboardRouter.get("/visitors", dashboard.visitors);
adminDashboardRouter.get("/activities", dashboard.activities);

export { adminDashboardRouter };
