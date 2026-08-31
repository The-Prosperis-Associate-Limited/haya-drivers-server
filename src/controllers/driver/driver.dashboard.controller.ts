import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverDashboardService } from "../../services/driver/driver.dashboard.service";
import { ActivityService } from "../../services/shared/activity.service";
import { TrustScoreService } from "../../services/shared/trustScore.service";

export class DriverDashboardController {
  private dashboardService = new DriverDashboardService();
  private activityService = new ActivityService();
  private trustScoreService = new TrustScoreService();

  stats = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.dashboardService.stats(req.userId as string);

      res.status(200).json({ message: "Dashboard stats fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  upcomingJobs = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.dashboardService.upcomingJobs(req.userId as string, Number(req.query.limit) || 5);

      res.status(200).json({ message: "Upcoming jobs fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  activities = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.activityService.listForUser(req.userId as string, req.query);

      res.status(200).json({ message: "Activities fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  trustScore = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trustScoreService.breakdown(req.userId as string);

      res.status(200).json({ message: "Trust score fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
