import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientDriverSearchService } from "../../services/client/client.driverSearch.service";
import { driverSearchSchema } from "../../utils/types/bookingValidatorSchema";

export class ClientDriverController {
  private driverSearchService = new ClientDriverSearchService();

  search = async (req: IUserRequest, res: Response) => {
    try {
      const filters = driverSearchSchema.parse(req.query);

      const result = await this.driverSearchService.search(req.query, filters);

      res.status(200).json({ message: "Drivers fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.driverSearchService.getPublicProfile(req.params.id);

      res.status(200).json({ message: "Driver fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reviews = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.driverSearchService.listReviews(req.params.id, req.query);

      res.status(200).json({ message: "Reviews fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
