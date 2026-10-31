import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ReferralService } from "../../services/referral/referral.service";
import { requestContext } from "../../utils/requestContext";
import { attachReferralCodeSchema } from "../../utils/types/referralValidatorSchema";

export class DriverReferralController {
  private referralService = new ReferralService();

  overview = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.referralService.overview(req.userId as string);

      res.status(200).json({ message: "Referral overview fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.referralService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Referrals fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  attach = async (req: IUserRequest, res: Response) => {
    try {
      const { code } = attachReferralCodeSchema.parse(req.body);

      await this.referralService.attach(req.userId as string, code, "ONBOARDING", requestContext(req));

      res.status(201).json({ message: "Referral code added" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
