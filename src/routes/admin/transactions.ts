import { Router } from "express";
import { AdminTransactionsController } from "../../controllers/admin/admin.transactions.controller";

const transactionsRouter = Router();
const transactions = new AdminTransactionsController();

transactionsRouter.get("/stats", transactions.stats);
transactionsRouter.get("/wallets", transactions.wallets);
transactionsRouter.get("/service-fees", transactions.serviceFees);

export { transactionsRouter };
