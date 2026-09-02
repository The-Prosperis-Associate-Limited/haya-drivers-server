import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverBookingService } from "../../services/driver/driver.booking.service";
import { declineBookingSchema, jobRequestFilterSchema } from "../../utils/types/bookingValidatorSchema";

export class DriverBookingController {
  private bookingService = new DriverBookingService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const { bucket } = jobRequestFilterSchema.parse(req.query);

      const result = await this.bookingService.list(req.userId as string, req.query, bucket);

      res.status(200).json({ message: "Job requests fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  summary = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.summary(req.userId as string);

      res.status(200).json({ message: "Job request summary fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.get(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Job request fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  accept = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.accept(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Job request accepted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  decline = async (req: IUserRequest, res: Response) => {
    try {
      const { reason } = declineBookingSchema.parse(req.body);

      const result = await this.bookingService.decline(req.userId as string, req.params.reference, reason);

      res.status(200).json({ message: "Job request declined", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  start = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.start(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Job started", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  complete = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.complete(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Job marked complete", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
