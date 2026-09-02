import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverReviewService } from "../../services/driver/driver.review.service";

export class DriverReviewController {
  private reviewService = new DriverReviewService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.reviewService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Reviews fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  summary = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.reviewService.summary(req.userId as string);

      res.status(200).json({ message: "Review summary fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
