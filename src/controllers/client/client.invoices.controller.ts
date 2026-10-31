import type { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import type { IUserRequest } from "../../interface";
import { ClientInvoicesService } from "../../services/client/client.invoices.service";
import { invoiceListQuerySchema } from "../../utils/types/hireValidatorSchema";

export class ClientInvoicesController {
  private invoicesService = new ClientInvoicesService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const query = invoiceListQuerySchema.parse(req.query);

      const result = await this.invoicesService.list(req.userId as string, query);

      res.status(200).json({ message: "Invoices fetched", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
