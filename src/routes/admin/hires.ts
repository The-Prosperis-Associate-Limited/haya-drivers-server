import { Router } from "express";
import { HireRequestController } from "../../controllers/client/hireRequest.controller";

const adminHiresRouter = Router();
const hires = new HireRequestController();

adminHiresRouter.get("/", hires.adminList);
adminHiresRouter.get("/:reference", hires.adminGet);
adminHiresRouter.post("/:reference/invoice", hires.generateInvoice);
adminHiresRouter.post("/:reference/decline", hires.decline);

export { adminHiresRouter };
