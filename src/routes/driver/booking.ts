import { Router } from "express";
import { DriverBookingController } from "../../controllers/driver/driver.booking.controller";
import { requireVerifiedDriver } from "../../middleware/requireVerifiedDriver";

const bookingRouter = Router();
const booking = new DriverBookingController();

// Job requests only reach a verified driver, so the whole router sits behind
// the gate rather than repeating it per route.
bookingRouter.use(requireVerifiedDriver);

bookingRouter.get("/", booking.list);
// Ahead of /:reference, or "summary" is read as a booking reference.
bookingRouter.get("/summary", booking.summary);
bookingRouter.get("/:reference", booking.get);
bookingRouter.patch("/:reference/accept", booking.accept);
bookingRouter.patch("/:reference/decline", booking.decline);
bookingRouter.patch("/:reference/start", booking.start);
bookingRouter.patch("/:reference/complete", booking.complete);

export { bookingRouter };
