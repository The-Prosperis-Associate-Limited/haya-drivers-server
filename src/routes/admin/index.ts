import { Router } from "express";
import { validateAccessToken, validateAdminSession } from "../../middleware/validateToken";
import { adminDashboardRouter } from "./dashboard";
import { adminTicketRouter } from "./tickets";
import { adminTrainingRouter } from "./training";
import { payoutsRouter } from "./payouts";
import { usersRouter } from "./users";
import { verificationsRouter } from "./verifications";

const adminRouter = Router();

adminRouter.use(validateAccessToken, validateAdminSession);

adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/users", usersRouter);
adminRouter.use("/verifications", verificationsRouter);
adminRouter.use("/payouts", payoutsRouter);
adminRouter.use("/training", adminTrainingRouter);
adminRouter.use("/tickets", adminTicketRouter);

export { adminRouter };
