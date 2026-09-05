import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverProfileService } from "../../services/driver/driver.profile.service";
import { workPreferencesSchema } from "../../utils/types/driverValidatorSchema";

export class DriverProfileController {
  private profileService = new DriverProfileService();

  updateWorkPreferences = async (req: IUserRequest, res: Response) => {
    try {
      const data = workPreferencesSchema.parse(req.body);

      const result = await this.profileService.saveWorkPreferences(req.userId as string, data);

      res.status(200).json({ message: "Work preferences saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
