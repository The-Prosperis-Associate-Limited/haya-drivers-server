import { Router } from "express";
import { HireRequestController } from "../../controllers/client/hireRequest.controller";

const adminHiresRouter = Router();
const hires = new HireRequestController();

adminHiresRouter.get("/", hires.adminList);
adminHiresRouter.get("/:reference", hires.adminGet);
adminHiresRouter.post("/:reference/assign", hires.assignDriver);
adminHiresRouter.post("/:reference/invoice", hires.generateInvoice);
adminHiresRouter.post("/:reference/confirm-payment", hires.confirmPayment);
adminHiresRouter.post("/:reference/reject-proof", hires.rejectProof);
adminHiresRouter.post("/:reference/decline", hires.decline);

export { adminHiresRouter };
