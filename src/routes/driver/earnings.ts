import { Router } from "express";
import { DriverEarningsController } from "../../controllers/driver/driver.earnings.controller";

const earningsRouter = Router();
const earnings = new DriverEarningsController();

earningsRouter.get("/", earnings.summary);
earningsRouter.get("/history", earnings.history);
earningsRouter.get("/trend", earnings.trend);

earningsRouter.get("/banks", earnings.listBanks);

earningsRouter.get("/bank-accounts", earnings.listBankAccounts);
earningsRouter.post("/bank-accounts", earnings.addBankAccount);
earningsRouter.patch("/bank-accounts/:id/default", earnings.setDefaultBankAccount);
earningsRouter.delete("/bank-accounts/:id", earnings.removeBankAccount);

earningsRouter.get("/withdrawals", earnings.listPayouts);
earningsRouter.post("/withdrawals", earnings.requestPayout);

export { earningsRouter };
