import { Router } from "express";
import { ClientDashboardController } from "../../controllers/client/client.dashboard.controller";

const clientDashboardRouter = Router();
const dashboard = new ClientDashboardController();

clientDashboardRouter.get("/stats", dashboard.stats);

export { clientDashboardRouter };
