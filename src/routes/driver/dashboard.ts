import { Router } from "express";
import { DriverDashboardController } from "../../controllers/driver/driver.dashboard.controller";

const dashboardRouter = Router();
const dashboard = new DriverDashboardController();

dashboardRouter.get("/stats", dashboard.stats);
dashboardRouter.get("/upcoming-jobs", dashboard.upcomingJobs);
dashboardRouter.get("/activities", dashboard.activities);
dashboardRouter.get("/trust-score", dashboard.trustScore);

export { dashboardRouter };
