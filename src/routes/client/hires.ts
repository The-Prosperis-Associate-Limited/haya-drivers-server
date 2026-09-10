import { Router } from "express";
import { ClientHiresController } from "../../controllers/client/client.hires.controller";

const clientHiresRouter = Router();
const hires = new ClientHiresController();

clientHiresRouter.get("/", hires.list);
clientHiresRouter.get("/:reference", hires.get);

export { clientHiresRouter };
