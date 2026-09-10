import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientWalletService, paymentFeeFor } from "../../services/client/client.wallet.service";
import { parsePagination } from "../../utils/pagination";
import { payDriverSchema, paymentQuoteSchema, walletTransactionFilterSchema } from "../../utils/types/clientValidatorSchema";

export class ClientWalletController {
  private walletService = new ClientWalletService();

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.walletService.getWallet(req.userId as string);

      res.status(200).json({ message: "Wallet fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  transactions = async (req: IUserRequest, res: Response) => {
    try {
      const pagination = parsePagination(req.query);
      const { type } = walletTransactionFilterSchema.parse(req.query);

      const { transactions, total } = await this.walletService.listTransactions(req.userId as string, { ...pagination, type });

      res.status(200).json({
        message: "Transactions fetched successfully",
        data: transactions,
        total,
        page: pagination.page,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  summary = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.walletService.summary(req.userId as string);

      res.status(200).json({ message: "Summary fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  // The Make Payment modal shows the fee before the client commits — quoting is
  // a server answer so the preview can never drift from what gets charged.
  quote = async (req: IUserRequest, res: Response) => {
    try {
      const { amount_minor } = paymentQuoteSchema.parse(req.query);

      const fee = paymentFeeFor(amount_minor);

      res.status(200).json({ message: "Quote computed", data: { amount_minor, fee_minor: fee, total_minor: amount_minor + fee } });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  pay = async (req: IUserRequest, res: Response) => {
    try {
      const data = payDriverSchema.parse(req.body);

      const result = await this.walletService.payDriver(req.userId as string, data);

      res.status(200).json({ message: "Payment sent", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  sync = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.walletService.syncFunding(req.userId as string);

      res.status(200).json({ message: "Funding synced", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
