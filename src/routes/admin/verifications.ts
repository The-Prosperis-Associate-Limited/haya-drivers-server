import { Router } from "express";
import { AdminVerificationController } from "../../controllers/admin/admin.verification.controller";

const verificationsRouter = Router();
const verifications = new AdminVerificationController();

verificationsRouter.get("/", verifications.queue);
verificationsRouter.get("/:userId", verifications.get);
verificationsRouter.patch("/documents/:documentId", verifications.reviewDocument);
verificationsRouter.patch("/:userId", verifications.reviewSubmission);

export { verificationsRouter };
