import { Router } from "express";
import { validateAccessToken, validateAdminSession } from "../../middleware/validateToken";
import { guardAdminWrites, requireSuperAdmin } from "../../middleware/adminAccess";
import { adminDashboardRouter } from "./dashboard";
import { adminAttendanceRouter } from "./attendance";
import { adminChatRouter } from "./chat";
import { adminHiresRouter } from "./hires";
import { adminSalariesRouter } from "./salaries";
import { adminTicketRouter } from "./tickets";
import { payoutsRouter } from "./payouts";
import { teamRouter } from "./team";
import { transactionsRouter } from "./transactions";
import { usersRouter } from "./users";
import { verificationsRouter } from "./verifications";
import { SearchController } from "../../controllers/search.controller";

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
adminRouter.use("/attendance", guardAdminWrites("tickets"), adminAttendanceRouter);
adminRouter.use("/salaries", guardAdminWrites("transactions"), adminSalariesRouter);
adminRouter.use("/team", requireSuperAdmin, teamRouter);
adminRouter.get("/search", new SearchController().admin);

export { adminRouter };
