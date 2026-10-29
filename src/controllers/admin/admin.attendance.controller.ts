import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AttendanceService } from "../../services/booking/attendance.service";
import { attendanceFlagListSchema, attendanceMonthSchema, resolveAttendanceFlagSchema } from "../../utils/types/attendanceValidatorSchema";

export class AdminAttendanceController {
  private attendanceService = new AttendanceService();

  listFlags = async (req: IUserRequest, res: Response) => {
    try {
      const { status } = attendanceFlagListSchema.parse(req.query);

      const result = await this.attendanceService.listFlags(status, req.query);

      res.status(200).json({ message: "Flagged days fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  resolveFlag = async (req: IUserRequest, res: Response) => {
    try {
      const { outcome, note } = resolveAttendanceFlagSchema.parse(req.body);

      const result = await this.attendanceService.resolveFlag(req.userId as string, req.params.id as string, outcome, note);

      res.status(200).json({ message: outcome === "UPHELD" ? "Flag upheld" : "Flag dismissed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  bookingLog = async (req: IUserRequest, res: Response) => {
    try {
      const { month } = attendanceMonthSchema.parse(req.query);

      const result = await this.attendanceService.adminLog(req.params.reference as string, month);

      res.status(200).json({ message: "Attendance fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
