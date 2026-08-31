import { Router } from "express";
import { ClientDriverController } from "../../controllers/client/client.driver.controller";

const driversRouter = Router();
const drivers = new ClientDriverController();

driversRouter.get("/", drivers.search);
driversRouter.get("/:id", drivers.get);
driversRouter.get("/:id/reviews", drivers.reviews);

export { driversRouter };
