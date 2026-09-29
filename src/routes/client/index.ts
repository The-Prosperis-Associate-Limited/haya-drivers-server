import { Router } from "express";
import { validateAccessToken, validateClientSession } from "../../middleware/validateToken";
import { clientBookingRouter } from "./booking";
import { clientDashboardRouter } from "./dashboard";
import { driversRouter } from "./drivers";
import { clientHireRequestsRouter } from "./hireRequests";
import { clientHiresRouter } from "./hires";
import { clientOnboardingRouter } from "./onboarding";
import { clientRequestsRouter } from "./requests";

const clientRouter = Router();

clientRouter.use(validateAccessToken, validateClientSession);

clientRouter.use("/drivers", driversRouter);
clientRouter.use("/bookings", clientBookingRouter);
clientRouter.use("/onboarding", clientOnboardingRouter);
clientRouter.use("/dashboard", clientDashboardRouter);
clientRouter.use("/hires", clientHiresRouter);
clientRouter.use("/hire-requests", clientHireRequestsRouter);
clientRouter.use("/requests", clientRequestsRouter);

export { clientRouter };
