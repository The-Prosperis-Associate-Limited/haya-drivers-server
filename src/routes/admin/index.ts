import { Router } from "express";
import { validateAccessToken, validateAdminSession } from "../../middleware/validateToken";
import { guardAdminWrites, requireSuperAdmin } from "../../middleware/adminAccess";
import { adminDashboardRouter } from "./dashboard";
import { adminChatRouter } from "./chat";
import { adminHiresRouter } from "./hires";
import { adminTicketRouter } from "./tickets";
import { payoutsRouter } from "./payouts";
import { teamRouter } from "./team";
import { transactionsRouter } from "./transactions";
import { usersRouter } from "./users";
import { verificationsRouter } from "./verifications";

const adminRouter = Router();

adminRouter.use(validateAccessToken, validateAdminSession);

adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/users", guardAdminWrites("users"), usersRouter);
adminRouter.use("/verifications", guardAdminWrites("verifications"), verificationsRouter);
adminRouter.use("/payouts", guardAdminWrites("transactions"), payoutsRouter);
adminRouter.use("/transactions", guardAdminWrites("transactions"), transactionsRouter);
adminRouter.use("/tickets", guardAdminWrites("tickets"), adminTicketRouter);
adminRouter.use("/chat", guardAdminWrites("tickets"), adminChatRouter);
adminRouter.use("/hires", guardAdminWrites("transactions"), adminHiresRouter);
adminRouter.use("/team", requireSuperAdmin, teamRouter);

export { adminRouter };
