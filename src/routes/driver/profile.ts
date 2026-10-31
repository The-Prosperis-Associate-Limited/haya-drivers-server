import { Router } from "express";
import { DriverProfileController } from "../../controllers/driver/driver.profile.controller";

const profileRouter = Router();
const profile = new DriverProfileController();

profileRouter.put("/work-preferences", profile.updateWorkPreferences);
profileRouter.patch("/open-to-work", profile.updateOpenToWork);
profileRouter.get("/preview", profile.preview);

export { profileRouter };
