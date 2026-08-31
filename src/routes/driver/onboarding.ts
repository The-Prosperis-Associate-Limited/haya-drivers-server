import { Router } from "express";
import { DriverOnboardingController } from "../../controllers/driver/driver.onboarding.controller";
import { DriverDocumentController } from "../../controllers/driver/driver.document.controller";
import { uploadDocument } from "../../utils/multerConfig";

const onboardingRouter = Router();
const onboarding = new DriverOnboardingController();
const documents = new DriverDocumentController();

onboardingRouter.get("/profile", onboarding.getProfile);
onboardingRouter.get("/verification-status", onboarding.verificationStatus);

onboardingRouter.put("/personal-information", onboarding.savePersonalInformation);
onboardingRouter.put("/experience", onboarding.saveExperience);
onboardingRouter.put("/academic-qualification", onboarding.saveAcademicQualification);
onboardingRouter.put("/additional-information", onboarding.saveAdditionalInformation);

onboardingRouter.put("/work-experience", onboarding.saveWorkExperience);
onboardingRouter.delete("/work-experience/:id", onboarding.deleteWorkExperience);

onboardingRouter.put("/guarantors", onboarding.saveGuarantors);
onboardingRouter.post("/guarantors/:id/:field", uploadDocument.single("file"), onboarding.uploadGuarantorFile);
onboardingRouter.delete("/guarantors/:id", onboarding.deleteGuarantor);

onboardingRouter.get("/documents", documents.list);
onboardingRouter.post("/documents", uploadDocument.single("file"), documents.upload);
onboardingRouter.delete("/documents/:id", documents.remove);

onboardingRouter.post("/submit", onboarding.submit);

export { onboardingRouter };
