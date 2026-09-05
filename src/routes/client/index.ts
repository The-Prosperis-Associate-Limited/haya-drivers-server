import { Router } from "express";
import { validateAccessToken, validateClientSession } from "../../middleware/validateToken";
import { clientBookingRouter } from "./booking";
import { driversRouter } from "./drivers";
import { clientOnboardingRouter } from "./onboarding";

const clientRouter = Router();

clientRouter.use(validateAccessToken, validateClientSession);

clientRouter.use("/drivers", driversRouter);
clientRouter.use("/bookings", clientBookingRouter);
clientRouter.use("/onboarding", clientOnboardingRouter);

export { clientRouter };
