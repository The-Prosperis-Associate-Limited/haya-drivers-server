import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientOnboardingService } from "../../services/client/client.onboarding.service";
import { clientPreferencesSchema } from "../../utils/types/clientValidatorSchema";

export class ClientOnboardingController {
  private onboardingService = new ClientOnboardingService();

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.onboardingService.getPreferences(req.userId as string);

      res.status(200).json({ message: "Preferences fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  save = async (req: IUserRequest, res: Response) => {
    try {
      const data = clientPreferencesSchema.parse(req.body);

      const result = await this.onboardingService.savePreferences(req.userId as string, data);

      res.status(200).json({ message: "Preferences saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  complete = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.onboardingService.complete(req.userId as string);

      res.status(200).json({ message: "Onboarding completed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
