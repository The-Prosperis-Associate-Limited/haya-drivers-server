import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverWalletService } from "../../services/driver/driver.wallet.service";

export class DriverWalletController {
  private walletService = new DriverWalletService();

  summary = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.walletService.summary(req.userId as string);

      res.status(200).json({ message: "Wallet fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  transactions = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.walletService.transactions(req.userId as string, req.query);

      res.status(200).json({ message: "Wallet transactions fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
