import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { SalaryService } from "../../services/booking/salary.service";
import { disputeSalarySchema } from "../../utils/types/salaryValidatorSchema";

export class DriverSalaryController {
  private salaryService = new SalaryService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.salaryService.driverList(req.userId as string, req.params.reference as string);

      res.status(200).json({ message: "Salary payments fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  confirm = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.salaryService.confirm(req.userId as string, req.params.reference as string, req.params.id as string);

      res.status(200).json({ message: "Payment confirmed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  dispute = async (req: IUserRequest, res: Response) => {
    try {
      const { reason } = disputeSalarySchema.parse(req.body);

      const result = await this.salaryService.dispute(req.userId as string, req.params.reference as string, req.params.id as string, reason);

      res.status(200).json({ message: "Reported - our team will look into it", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
