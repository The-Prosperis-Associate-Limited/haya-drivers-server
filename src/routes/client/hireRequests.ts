import { Router } from "express";
import { HireRequestController } from "../../controllers/client/hireRequest.controller";
import { uploadDocument } from "../../utils/multerConfig";

const clientHireRequestsRouter = Router();
const hires = new HireRequestController();

clientHireRequestsRouter.post("/", hires.create);
clientHireRequestsRouter.get("/", hires.list);
clientHireRequestsRouter.get("/:reference", hires.get);
clientHireRequestsRouter.post("/:reference/proof", uploadDocument.single("file"), hires.submitProof);
clientHireRequestsRouter.post("/:reference/cancel", hires.cancel);

export { clientHireRequestsRouter };
