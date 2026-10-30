import { Router } from "express";
import { ClientHiresController } from "../../controllers/client/client.hires.controller";
import { ClientSalaryController } from "../../controllers/client/client.salary.controller";
import { uploadDocument } from "../../utils/multerConfig";

const clientHiresRouter = Router();
const hires = new ClientHiresController();
const salary = new ClientSalaryController();

clientHiresRouter.get("/", hires.list);
clientHiresRouter.get("/:reference", hires.get);
clientHiresRouter.get("/:reference/attendance", hires.attendance);
clientHiresRouter.post("/:reference/attendance/:id/flag", hires.flagAttendance);
clientHiresRouter.get("/:reference/salary", salary.list);
clientHiresRouter.post("/:reference/salary/:id/paid", uploadDocument.single("receipt"), salary.markPaid);

export { clientHiresRouter };
