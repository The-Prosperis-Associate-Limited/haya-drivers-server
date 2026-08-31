import { Router } from "express";
import { TicketController } from "../../controllers/ticket.controller";

const adminTicketRouter = Router();
const tickets = new TicketController();

adminTicketRouter.get("/", tickets.listAll);
adminTicketRouter.get("/:id", tickets.get);
adminTicketRouter.post("/:id/comments", tickets.comment);
adminTicketRouter.patch("/:id", tickets.update);

export { adminTicketRouter };
