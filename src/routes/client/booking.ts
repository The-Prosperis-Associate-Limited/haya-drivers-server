import { Router } from "express";
import { ClientBookingController } from "../../controllers/client/client.booking.controller";

const clientBookingRouter = Router();
const booking = new ClientBookingController();

clientBookingRouter.get("/", booking.list);
clientBookingRouter.get("/:reference", booking.get);
clientBookingRouter.patch("/:reference/cancel", booking.cancel);
clientBookingRouter.post("/:reference/review", booking.review);

export { clientBookingRouter };
