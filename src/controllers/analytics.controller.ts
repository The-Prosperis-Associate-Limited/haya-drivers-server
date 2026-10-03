import type { Request, Response } from "express";
import { AnalyticsService } from "../services/shared/analytics.service";
import { handleErrors } from "../helper/handleErrors";

export class AnalyticsController {
  private analyticsService = new AnalyticsService();

  recordVisit = async (req: Request, res: Response) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
      const userAgent = req.headers["user-agent"] ?? "unknown";

      const result = await this.analyticsService.recordVisit(ip, userAgent);

      res.status(200).json({ message: "Recorded", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
