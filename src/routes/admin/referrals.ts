import { Router } from "express";
import { AdminReferralsController } from "../../controllers/admin/admin.referrals.controller";

const referralsRouter = Router();
const referrals = new AdminReferralsController();

referralsRouter.get("/overview", referrals.overview);
referralsRouter.get("/network", referrals.network);
referralsRouter.get("/leaderboard", referrals.leaderboard);
referralsRouter.get("/referrers/:userId", referrals.referrer);
referralsRouter.get("/", referrals.list);
referralsRouter.get("/:id", referrals.get);
referralsRouter.post("/:id/approve", referrals.approve);
referralsRouter.post("/:id/reject", referrals.reject);
referralsRouter.post("/:id/reverse", referrals.reverse);

export { referralsRouter };
