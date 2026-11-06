import { Router } from "express";
import { AdminVerificationController } from "../../controllers/admin/admin.verification.controller";

const verificationsRouter = Router();
const verifications = new AdminVerificationController();

verificationsRouter.get("/", verifications.queue);
verificationsRouter.get("/document-updates", verifications.documentUpdates);
verificationsRouter.get("/required-documents-notice", verifications.requiredDocumentsNotice);
verificationsRouter.post("/required-documents-notice", verifications.sendRequiredDocumentsNotice);
verificationsRouter.get("/:userId", verifications.get);
verificationsRouter.patch("/documents/:documentId", verifications.reviewDocument);
verificationsRouter.patch("/:userId", verifications.reviewSubmission);

export { verificationsRouter };
