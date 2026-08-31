import { Router } from "express";
import { PushSubscriptionController } from "../controllers/pushsubscription.controller";
import { validateAccessToken } from "../middleware/validateToken";

const pushRouter = Router();
const push = new PushSubscriptionController();

pushRouter.use(validateAccessToken);

pushRouter.post("/device-token", push.registerDeviceToken);
pushRouter.delete("/device-token", push.unregisterDeviceToken);
pushRouter.post("/web", push.subscribeWebPush);
pushRouter.delete("/web", push.unsubscribeWebPush);

export { pushRouter };
