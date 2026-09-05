import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientDashboardService } from "../../services/client/client.dashboard.service";

export class ClientDashboardController {
  private dashboardService = new ClientDashboardService();

  stats = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.dashboardService.stats(req.userId as string);

      res.status(200).json({ message: "Stats fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
