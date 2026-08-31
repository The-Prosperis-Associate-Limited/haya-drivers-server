import { Router } from "express";
import { TicketController } from "../controllers/ticket.controller";
import { validateAccessToken } from "../middleware/validateToken";

const ticketRouter = Router();
const tickets = new TicketController();

ticketRouter.use(validateAccessToken);

ticketRouter.post("/", tickets.create);
ticketRouter.get("/", tickets.list);
ticketRouter.get("/:id", tickets.get);
ticketRouter.post("/:id/comments", tickets.comment);

export { ticketRouter };
