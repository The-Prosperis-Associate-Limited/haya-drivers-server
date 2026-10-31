import { Router } from "express";
import { DriverReferralController } from "../../controllers/driver/driver.referral.controller";
import { credentialLimiter } from "../../middleware/rateLimit";

const referralRouter = Router();
const referrals = new DriverReferralController();

referralRouter.get("/", referrals.overview);
referralRouter.get("/list", referrals.list);
referralRouter.post("/attach", credentialLimiter, referrals.attach);

export { referralRouter };
