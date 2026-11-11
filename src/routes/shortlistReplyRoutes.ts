import { Router } from "express";
import { DriverShortlistController } from "../controllers/driver/driver.shortlist.controller";
import { credentialLimiter } from "../middleware/rateLimit";

const shortlistReplyRouter = Router();
const shortlist = new DriverShortlistController();

// Public by design - the signed token from the invite email is the credential, so drivers answer without signing in.
shortlistReplyRouter.get("/:token", credentialLimiter, shortlist.replyPreview);
shortlistReplyRouter.post("/:token", credentialLimiter, shortlist.reply);

export { shortlistReplyRouter };
