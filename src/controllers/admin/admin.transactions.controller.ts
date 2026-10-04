import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminTransactionsService } from "../../services/admin/admin.transactions.service";

export class AdminTransactionsController {
  private transactionsService = new AdminTransactionsService();

  stats = async (_req: IUserRequest, res: Response) => {
    try {
      const result = await this.transactionsService.stats();

      res.status(200).json({ message: "Transaction stats fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
