import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";

const analyticsRouter = Router();
const analytics = new AnalyticsController();

// Public by design - the beacon fires from the marketing pages before signin.
analyticsRouter.post("/visit", analytics.recordVisit);

export { analyticsRouter };
