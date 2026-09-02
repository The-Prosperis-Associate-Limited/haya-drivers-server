import { Router } from "express";
import { validateAccessToken, validateDriverSession } from "../../middleware/validateToken";
import { bookingRouter } from "./booking";
import { dashboardRouter } from "./dashboard";
import { earningsRouter } from "./earnings";
import { onboardingRouter } from "./onboarding";
import { reviewRouter } from "./reviews";
import { trainingRouter } from "./training";

const driverRouter = Router();

// Authorisation is mounted once for the whole area. Do not repeat
// validateAccessToken on the sub-routers — that is how an area ends up
// authenticated but not authorised.
driverRouter.use(validateAccessToken, validateDriverSession);

driverRouter.use("/onboarding", onboardingRouter);
driverRouter.use("/dashboard", dashboardRouter);
driverRouter.use("/job-requests", bookingRouter);
driverRouter.use("/earnings", earningsRouter);
driverRouter.use("/training", trainingRouter);
driverRouter.use("/reviews", reviewRouter);

export { driverRouter };
