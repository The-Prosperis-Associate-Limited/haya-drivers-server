import { Router } from "express";
import { ClientHiresController } from "../../controllers/client/client.hires.controller";

const clientHiresRouter = Router();
const hires = new ClientHiresController();

clientHiresRouter.get("/", hires.list);
clientHiresRouter.get("/:reference", hires.get);
clientHiresRouter.get("/:reference/attendance", hires.attendance);
clientHiresRouter.post("/:reference/attendance/:id/flag", hires.flagAttendance);

export { clientHiresRouter };
