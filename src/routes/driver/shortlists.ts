import { Router } from "express";
import { DriverShortlistController } from "../../controllers/driver/driver.shortlist.controller";

const shortlistRouter = Router();
const shortlist = new DriverShortlistController();

shortlistRouter.get("/", shortlist.list);
shortlistRouter.post("/:id/respond", shortlist.respond);

export { shortlistRouter };
