import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminPayoutsService } from "../../services/admin/admin.payouts.service";
import { reviewPayoutSchema } from "../../utils/types/earningsValidatorSchema";

export class AdminPayoutsController {
  private payoutsService = new AdminPayoutsService();

  queue = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutsService.queue(req.query);

      res.status(200).json({ message: "Payouts fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutsService.get(req.params.reference);

      res.status(200).json({ message: "Payout fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  settle = async (req: IUserRequest, res: Response) => {
    try {
      const { status, failure_reason } = reviewPayoutSchema.parse(req.body);

      const result = await this.payoutsService.settle(req.params.reference, status, failure_reason);

      res.status(200).json({ message: "Payout updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
