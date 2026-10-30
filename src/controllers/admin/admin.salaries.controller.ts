import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { SalaryService } from "../../services/booking/salary.service";
import { resolveSalarySchema, salaryListSchema } from "../../utils/types/salaryValidatorSchema";

export class AdminSalariesController {
  private salaryService = new SalaryService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const { status } = salaryListSchema.parse(req.query);

      const result = await this.salaryService.adminList(status, req.query);

      res.status(200).json({ message: "Salary payments fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  resolve = async (req: IUserRequest, res: Response) => {
    try {
      const { outcome, note } = resolveSalarySchema.parse(req.body);

      const result = await this.salaryService.resolve(req.userId as string, req.params.id as string, outcome, note);

      res.status(200).json({ message: outcome === "PAID" ? "Recorded as paid" : "Salary reopened as due", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  bookingLog = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.salaryService.adminBookingList(req.params.reference as string);

      res.status(200).json({ message: "Salary payments fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
