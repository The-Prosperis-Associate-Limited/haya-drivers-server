import { Router } from "express";
import { DriverProfileController } from "../../controllers/driver/driver.profile.controller";

const profileRouter = Router();
const profile = new DriverProfileController();

profileRouter.put("/work-preferences", profile.updateWorkPreferences);

export { profileRouter };
