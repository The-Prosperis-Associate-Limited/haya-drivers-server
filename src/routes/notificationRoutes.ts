import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { validateAccessToken } from "../middleware/validateToken";

const notificationRouter = Router();
const notifications = new NotificationController();

notificationRouter.use(validateAccessToken);

notificationRouter.get("/", notifications.list);
notificationRouter.get("/unread-count", notifications.unreadCount);
notificationRouter.get("/preferences", notifications.preferences);
notificationRouter.put("/preferences", notifications.updatePreferences);
notificationRouter.patch("/read-all", notifications.markAllAsRead);
notificationRouter.patch("/:id/read", notifications.markAsRead);
notificationRouter.delete("/:id", notifications.remove);

export { notificationRouter };
