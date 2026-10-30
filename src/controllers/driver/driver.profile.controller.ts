import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientDriverSearchService } from "../../services/client/client.driverSearch.service";
import { DriverProfileService } from "../../services/driver/driver.profile.service";
import { openToWorkSchema, workPreferencesSchema } from "../../utils/types/driverValidatorSchema";

export class DriverProfileController {
  private profileService = new DriverProfileService();
  private driverSearchService = new ClientDriverSearchService();

  updateWorkPreferences = async (req: IUserRequest, res: Response) => {
    try {
      const data = workPreferencesSchema.parse(req.body);

      const result = await this.profileService.saveWorkPreferences(req.userId as string, data);

      res.status(200).json({ message: "Work preferences saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  preview = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.driverSearchService.getPreviewForDriver(req.userId as string);

      res.status(200).json({ message: "Profile preview fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updateOpenToWork = async (req: IUserRequest, res: Response) => {
    try {
      const { open_to_work } = openToWorkSchema.parse(req.body);

      const result = await this.profileService.setOpenToWork(req.userId as string, open_to_work);

      res.status(200).json({ message: open_to_work ? "You're available for work" : "You're hidden from new jobs", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
