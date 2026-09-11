import { Router } from "express";
import { ClientRequestsController } from "../../controllers/client/client.requests.controller";

const clientRequestsRouter = Router();
const requests = new ClientRequestsController();

clientRequestsRouter.post("/", requests.create);
clientRequestsRouter.get("/", requests.list);
clientRequestsRouter.patch("/:reference/close", requests.close);
clientRequestsRouter.get("/:reference/matches", requests.matches);

export { clientRequestsRouter };
