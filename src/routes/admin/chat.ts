import { Router } from "express";
import { ChatController } from "../../controllers/chat.controller";

const adminChatRouter = Router();
const chat = new ChatController();

adminChatRouter.get("/", chat.listInbox);
adminChatRouter.get("/:conversationId", chat.getForAdmin);
adminChatRouter.post("/:conversationId/join", chat.join);
adminChatRouter.post("/:conversationId/message", chat.reply);
adminChatRouter.post("/:conversationId/resolve", chat.resolve);
adminChatRouter.post("/:conversationId/read", chat.markRead);

export { adminChatRouter };
