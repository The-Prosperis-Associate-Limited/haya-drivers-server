import { Router } from "express";
import { DriverWalletController } from "../../controllers/driver/driver.wallet.controller";

const walletRouter = Router();
const wallet = new DriverWalletController();

walletRouter.get("/", wallet.summary);
walletRouter.get("/transactions", wallet.transactions);

export { walletRouter };
