import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverEarningsService } from "../../services/driver/driver.earnings.service";
import { PayoutService } from "../../services/earnings/payout.service";
import { addBankAccountSchema, requestPayoutSchema, resolveBankAccountSchema } from "../../utils/types/earningsValidatorSchema";

export class DriverEarningsController {
  private earningsService = new DriverEarningsService();
  private payoutService = new PayoutService();

  summary = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.earningsService.summary(req.userId as string);

      res.status(200).json({ message: "Earnings fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  history = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.earningsService.history(req.userId as string, req.query);

      res.status(200).json({ message: "Earning history fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  statement = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.earningsService.statement(req.userId as string, String(req.params.month));

      res.status(200).json({ message: "Statement fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  trend = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.earningsService.trend(req.userId as string);

      res.status(200).json({ message: "Earning trend fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listBanks = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutService.listBanks((req.query.country as string) ?? "nigeria", (req.query.currency as string) ?? "NGN");

      res.status(200).json({ message: "Banks fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listBankAccounts = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutService.listBankAccounts(req.userId as string);

      res.status(200).json({ message: "Bank accounts fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  resolveBankAccount = async (req: IUserRequest, res: Response) => {
    try {
      const data = resolveBankAccountSchema.parse(req.body);

      const result = await this.payoutService.resolveBankAccount(data);

      res.status(200).json({ message: "Account resolved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  addBankAccount = async (req: IUserRequest, res: Response) => {
    try {
      const data = addBankAccountSchema.parse(req.body);

      const result = await this.payoutService.addBankAccount(req.userId as string, data);

      res.status(201).json({ message: "Bank account added", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  setDefaultBankAccount = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutService.setDefaultBankAccount(req.userId as string, req.params.id);

      res.status(200).json({ message: "Default account updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  removeBankAccount = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutService.removeBankAccount(req.userId as string, req.params.id);

      res.status(200).json({ message: "Bank account removed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  requestPayout = async (req: IUserRequest, res: Response) => {
    try {
      const { amount, bankAccountId } = requestPayoutSchema.parse(req.body);

      const result = await this.payoutService.requestPayout(req.userId as string, amount, bankAccountId);

      res.status(201).json({ message: "Withdrawal requested", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listPayouts = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.payoutService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Withdrawals fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
