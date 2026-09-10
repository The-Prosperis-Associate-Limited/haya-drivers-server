import { Router } from "express";
import { ClientWalletController } from "../../controllers/client/client.wallet.controller";

const clientWalletRouter = Router();
const wallet = new ClientWalletController();

clientWalletRouter.get("/", wallet.get);
clientWalletRouter.get("/transactions", wallet.transactions);
clientWalletRouter.get("/summary", wallet.summary);
clientWalletRouter.get("/quote", wallet.quote);
clientWalletRouter.post("/pay", wallet.pay);
clientWalletRouter.post("/sync", wallet.sync);

export { clientWalletRouter };
