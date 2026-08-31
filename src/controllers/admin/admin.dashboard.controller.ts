import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminDashboardService } from "../../services/admin/admin.dashboard.service";

export class AdminDashboardController {
  private dashboardService = new AdminDashboardService();

  stats = async (_req: IUserRequest, res: Response) => {
    try {
      const result = await this.dashboardService.stats();

      res.status(200).json({ message: "Dashboard stats fetched successfully", data: result });
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
