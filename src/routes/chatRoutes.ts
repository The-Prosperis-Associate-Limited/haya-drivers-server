import { Router } from "express";
import { ChatController } from "../controllers/chat.controller";
import { validateAccessToken } from "../middleware/validateToken";

const chatRouter = Router();
const chat = new ChatController();

chatRouter.use(validateAccessToken);

chatRouter.get("/conversation", chat.getConversation);
chatRouter.post("/message", chat.sendMessage);
chatRouter.post("/:conversationId/read", chat.markRead);

export { chatRouter };
