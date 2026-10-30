import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { SalaryService } from "../../services/booking/salary.service";
import { markSalaryPaidSchema } from "../../utils/types/salaryValidatorSchema";

export class ClientSalaryController {
  private salaryService = new SalaryService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.salaryService.clientList(req.userId as string, req.params.reference as string);

      res.status(200).json({ message: "Salary payments fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  markPaid = async (req: IUserRequest, res: Response) => {
    try {
      const { note } = markSalaryPaidSchema.parse(req.body);

      const result = await this.salaryService.markPaid(req.userId as string, req.params.reference as string, req.params.id as string, req.file, note);

      res.status(200).json({ message: "Marked as paid - we've asked your driver to confirm", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
