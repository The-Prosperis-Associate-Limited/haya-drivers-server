import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminDashboardService } from "../../services/admin/admin.dashboard.service";
import { AnalyticsService } from "../../services/shared/analytics.service";
import { growthPeriodSchema } from "../../utils/types/adminValidatorSchema";

export class AdminDashboardController {
  private dashboardService = new AdminDashboardService();
  private analyticsService = new AnalyticsService();

  stats = async (_req: IUserRequest, res: Response) => {
    try {
      const result = await this.dashboardService.stats();

      res.status(200).json({ message: "Dashboard stats fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  growth = async (req: IUserRequest, res: Response) => {
    try {
      const { period } = growthPeriodSchema.parse(req.query);

      const result = await this.dashboardService.growth(period);

      res.status(200).json({ message: "Growth series fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  visitors = async (req: IUserRequest, res: Response) => {
    try {
      const { period } = growthPeriodSchema.parse(req.query);

      const result = await this.analyticsService.visitorSeries(period);

      res.status(200).json({ message: "Visitor series fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  activities = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.dashboardService.recentActivity(Number(req.query.limit) || 20);

      res.status(200).json({ message: "Activities fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
