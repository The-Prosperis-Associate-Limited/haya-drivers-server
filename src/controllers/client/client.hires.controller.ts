import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientHiresService } from "../../services/client/client.hires.service";
import { attendanceMonthSchema, flagAttendanceSchema } from "../../utils/types/attendanceValidatorSchema";

export class ClientHiresController {
  private hiresService = new ClientHiresService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.hiresService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Hires fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.hiresService.get(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Hire fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  attendance = async (req: IUserRequest, res: Response) => {
    try {
      const { month } = attendanceMonthSchema.parse(req.query);

      const result = await this.hiresService.attendance(req.userId as string, req.params.reference, month);

      res.status(200).json({ message: "Attendance fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  flagAttendance = async (req: IUserRequest, res: Response) => {
    try {
      const { reason } = flagAttendanceSchema.parse(req.body);

      const result = await this.hiresService.flagAttendance(req.userId as string, req.params.reference, req.params.id, reason);

      res.status(200).json({ message: "Day flagged - our team will look into it", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
