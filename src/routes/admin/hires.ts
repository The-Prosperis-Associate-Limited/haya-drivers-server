import { Router } from "express";
import { HireRequestController } from "../../controllers/client/hireRequest.controller";

const adminHiresRouter = Router();
const hires = new HireRequestController();

adminHiresRouter.get("/", hires.adminList);
adminHiresRouter.get("/pricing-guide", hires.pricingGuide);
adminHiresRouter.get("/:reference", hires.adminGet);
adminHiresRouter.get("/:reference/invoice-quote", hires.quoteInvoice);
adminHiresRouter.post("/:reference/assign", hires.assignDriver);
adminHiresRouter.post("/:reference/unassign", hires.unassignDriver);
adminHiresRouter.post("/:reference/invoice", hires.generateInvoice);
adminHiresRouter.post("/:reference/confirm-payment", hires.confirmPayment);
adminHiresRouter.post("/:reference/reject-proof", hires.rejectProof);
adminHiresRouter.post("/:reference/decline", hires.decline);

export { adminHiresRouter };
