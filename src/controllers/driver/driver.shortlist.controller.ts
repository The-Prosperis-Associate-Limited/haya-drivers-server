import type { Response } from "express";
import z from "zod";
import { DriverShortlistService } from "../../services/driver/driver.shortlist.service";
import { handleErrors } from "../../helper/handleErrors";
import type { IUserRequest } from "../../interface";

const respondSchema = z.object({ available: z.boolean() });

export class DriverShortlistController {
  private shortlistService = new DriverShortlistService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.shortlistService.list(req.userId as string);

      res.status(200).json({ message: "Shortlists fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  respond = async (req: IUserRequest, res: Response) => {
    try {
      const { available } = respondSchema.parse(req.body);

      const result = await this.shortlistService.respond(req.userId as string, req.params.id as string, available);

      res.status(200).json({ message: available ? "Availability confirmed" : "Marked as not available", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
