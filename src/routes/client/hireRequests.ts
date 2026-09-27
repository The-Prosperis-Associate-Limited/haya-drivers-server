import { Router } from "express";
import { HireRequestController } from "../../controllers/client/hireRequest.controller";

const clientHireRequestsRouter = Router();
const hires = new HireRequestController();

clientHireRequestsRouter.post("/", hires.create);
clientHireRequestsRouter.get("/", hires.list);
clientHireRequestsRouter.get("/:reference", hires.get);
clientHireRequestsRouter.post("/:reference/pay", hires.pay);
clientHireRequestsRouter.post("/:reference/cancel", hires.cancel);

export { clientHireRequestsRouter };
