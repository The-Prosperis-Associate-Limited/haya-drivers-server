import { Router } from "express";
import { ClientInvoicesController } from "../../controllers/client/client.invoices.controller";

const clientInvoicesRouter = Router();
const invoices = new ClientInvoicesController();

clientInvoicesRouter.get("/", invoices.list);

export { clientInvoicesRouter };
