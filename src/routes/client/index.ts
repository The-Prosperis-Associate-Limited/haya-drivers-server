import { Router } from "express";
import { validateAccessToken, validateClientSession } from "../../middleware/validateToken";
import { clientBookingRouter } from "./booking";
import { driversRouter } from "./drivers";

const clientRouter = Router();

clientRouter.use(validateAccessToken, validateClientSession);

clientRouter.use("/drivers", driversRouter);
clientRouter.use("/bookings", clientBookingRouter);

export { clientRouter };
