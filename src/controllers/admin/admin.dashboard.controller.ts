import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminDashboardService } from "../../services/admin/admin.dashboard.service";
import { AdminOverviewService } from "../../services/admin/admin.overview.service";
import { AnalyticsService } from "../../services/shared/analytics.service";
import { growthPeriodSchema, overviewPeriodSchema } from "../../utils/types/adminValidatorSchema";

export class AdminDashboardController {
  private dashboardService = new AdminDashboardService();
  private overviewService = new AdminOverviewService();
  private analyticsService = new AnalyticsService();

  nav = async (_req: IUserRequest, res: Response) => {
    try {
      res.status(200).json({ message: "Navigation counts fetched successfully", data: await this.overviewService.nav() });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  overview = async (req: IUserRequest, res: Response) => {
    try {
      const { period } = overviewPeriodSchema.parse(req.query);

      res.status(200).json({ message: "Overview fetched successfully", data: await this.overviewService.overview(period) });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

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
