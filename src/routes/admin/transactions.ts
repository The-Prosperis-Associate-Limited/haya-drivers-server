import { Router } from "express";
import { AdminTransactionsController } from "../../controllers/admin/admin.transactions.controller";

const transactionsRouter = Router();
const transactions = new AdminTransactionsController();

transactionsRouter.get("/stats", transactions.stats);

export { transactionsRouter };
