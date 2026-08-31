import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientBookingService } from "../../services/client/client.booking.service";
import { cancelBookingSchema, createBookingSchema, reviewBookingSchema } from "../../utils/types/bookingValidatorSchema";

export class ClientBookingController {
  private bookingService = new ClientBookingService();

  create = async (req: IUserRequest, res: Response) => {
    try {
      const data = createBookingSchema.parse(req.body);

      const result = await this.bookingService.create(req.userId as string, data);

      res.status(201).json({ message: "Job request sent", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Bookings fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.bookingService.get(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Booking fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  cancel = async (req: IUserRequest, res: Response) => {
    try {
      const { reason } = cancelBookingSchema.parse(req.body);

      const result = await this.bookingService.cancel(req.userId as string, req.params.reference, reason);

      res.status(200).json({ message: "Booking cancelled", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  review = async (req: IUserRequest, res: Response) => {
    try {
      const data = reviewBookingSchema.parse(req.body);

      const result = await this.bookingService.review(req.userId as string, req.params.reference, data);

      res.status(201).json({ message: "Review submitted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
