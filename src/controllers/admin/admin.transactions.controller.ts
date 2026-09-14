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

  wallets = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.transactionsService.wallets(req.query);

      res.status(200).json({ message: "Client wallets fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  serviceFees = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.transactionsService.serviceFees(req.query);

      res.status(200).json({ message: "Service fees fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
