import { Router } from "express";
import { HireRequestController } from "../controllers/client/hireRequest.controller";

const pricingRouter = Router();
const hires = new HireRequestController();

// Public by design - the landing page shows the same numbers the invoice uses.
pricingRouter.get("/", hires.pricingGuide);

export { pricingRouter };
