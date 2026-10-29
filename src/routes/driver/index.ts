import { Router } from "express";
import { validateAccessToken, validateDriverSession } from "../../middleware/validateToken";
import { bookingRouter } from "./booking";
import { dashboardRouter } from "./dashboard";
import { earningsRouter } from "./earnings";
import { onboardingRouter } from "./onboarding";
import { profileRouter } from "./profile";
import { reviewRouter } from "./reviews";
import { shortlistRouter } from "./shortlists";
import { SearchController } from "../../controllers/search.controller";

const driverRouter = Router();

// Authorisation is mounted once for the whole area. Do not repeat
// validateAccessToken on the sub-routers - that is how an area ends up
// authenticated but not authorised.
driverRouter.use(validateAccessToken, validateDriverSession);

driverRouter.use("/onboarding", onboardingRouter);
driverRouter.use("/profile", profileRouter);
driverRouter.use("/dashboard", dashboardRouter);
driverRouter.use("/job-requests", bookingRouter);
driverRouter.use("/earnings", earningsRouter);
driverRouter.use("/shortlists", shortlistRouter);
driverRouter.use("/reviews", reviewRouter);
driverRouter.get("/search", new SearchController().driver);

export { driverRouter };
