import { Router } from "express";
import { AdminPayoutsController } from "../../controllers/admin/admin.payouts.controller";

const payoutsRouter = Router();
const payouts = new AdminPayoutsController();

payoutsRouter.get("/", payouts.queue);
payoutsRouter.get("/:reference", payouts.get);
payoutsRouter.patch("/:reference", payouts.settle);

export { payoutsRouter };
