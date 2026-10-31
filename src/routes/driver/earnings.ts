import { Router } from "express";
import { credentialLimiter } from "../../middleware/rateLimit";
import { DriverEarningsController } from "../../controllers/driver/driver.earnings.controller";

const earningsRouter = Router();
const earnings = new DriverEarningsController();

earningsRouter.get("/", earnings.summary);
earningsRouter.get("/history", earnings.history);
earningsRouter.get("/trend", earnings.trend);
earningsRouter.get("/statements/:month", earnings.statement);

earningsRouter.get("/banks", earnings.listBanks);

earningsRouter.get("/bank-accounts", earnings.listBankAccounts);
earningsRouter.post("/bank-accounts/resolve", credentialLimiter, earnings.resolveBankAccount);
earningsRouter.post("/bank-accounts", credentialLimiter, earnings.addBankAccount);
earningsRouter.patch("/bank-accounts/:id/default", earnings.setDefaultBankAccount);
earningsRouter.delete("/bank-accounts/:id", earnings.removeBankAccount);

earningsRouter.get("/withdrawals", earnings.listPayouts);
earningsRouter.post("/withdrawals", earnings.requestPayout);

export { earningsRouter };
