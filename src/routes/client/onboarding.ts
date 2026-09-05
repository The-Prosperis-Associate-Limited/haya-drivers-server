import { Router } from "express";
import { ClientOnboardingController } from "../../controllers/client/client.onboarding.controller";

const clientOnboardingRouter = Router();
const onboarding = new ClientOnboardingController();

clientOnboardingRouter.get("/", onboarding.get);
clientOnboardingRouter.put("/", onboarding.save);
clientOnboardingRouter.post("/complete", onboarding.complete);

export { clientOnboardingRouter };
