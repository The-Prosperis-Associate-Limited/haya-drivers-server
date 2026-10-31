import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminReferralInsightsService } from "../../services/admin/admin.referralInsights.service";
import { AdminReferralsService } from "../../services/admin/admin.referrals.service";
import { approveReferralSchema, rejectReferralSchema } from "../../utils/types/referralValidatorSchema";

export class AdminReferralsController {
  private referralsService = new AdminReferralsService();
  private insightsService = new AdminReferralInsightsService();

  overview = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.insightsService.overview(typeof req.query.range === "string" ? req.query.range : undefined);

      res.status(200).json({ message: "Referral overview fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  network = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.insightsService.network(Number(req.query.limit) || 6);

      res.status(200).json({ message: "Referral network fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  leaderboard = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.insightsService.leaderboard(Number(req.query.limit) || 8);

      res.status(200).json({ message: "Referral leaderboard fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  referrer = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.insightsService.referrer(req.params.userId);

      res.status(200).json({ message: "Referrer fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.referralsService.list(req.query);

      res.status(200).json({ message: "Referrals fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.referralsService.get(req.params.id);

      res.status(200).json({ message: "Referral fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  approve = async (req: IUserRequest, res: Response) => {
    try {
      const { note } = approveReferralSchema.parse(req.body ?? {});

      const result = await this.referralsService.approve(req.params.id, req.userId as string, note);

      res.status(200).json({ message: "Referral reward approved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reject = async (req: IUserRequest, res: Response) => {
    try {
      const { reason } = rejectReferralSchema.parse(req.body);

      const result = await this.referralsService.reject(req.params.id, req.userId as string, reason);

      res.status(200).json({ message: "Referral reward rejected", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reverse = async (req: IUserRequest, res: Response) => {
    try {
      const { reason } = rejectReferralSchema.parse(req.body);

      const result = await this.referralsService.reverse(req.params.id, req.userId as string, reason);

      res.status(200).json({ message: "Referral reward reversed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
