import { Router } from "express";
import { validateAccessToken, validateClientSession } from "../../middleware/validateToken";
import { clientBookingRouter } from "./booking";
import { clientDashboardRouter } from "./dashboard";
import { driversRouter } from "./drivers";
import { clientHireRequestsRouter } from "./hireRequests";
import { clientInvoicesRouter } from "./invoices";
import { clientHiresRouter } from "./hires";
import { clientOnboardingRouter } from "./onboarding";
import { clientRequestsRouter } from "./requests";
import { SearchController } from "../../controllers/search.controller";

const clientRouter = Router();

clientRouter.use(validateAccessToken, validateClientSession);

clientRouter.use("/drivers", driversRouter);
clientRouter.use("/bookings", clientBookingRouter);
clientRouter.use("/onboarding", clientOnboardingRouter);
clientRouter.use("/dashboard", clientDashboardRouter);
clientRouter.use("/hires", clientHiresRouter);
clientRouter.use("/hire-requests", clientHireRequestsRouter);
clientRouter.use("/invoices", clientInvoicesRouter);
clientRouter.use("/requests", clientRequestsRouter);
clientRouter.get("/search", new SearchController().client);

export { clientRouter };
