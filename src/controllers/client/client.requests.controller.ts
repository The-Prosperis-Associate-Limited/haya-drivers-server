import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientRequestsService } from "../../services/client/client.requests.service";
import { createStaffingRequestSchema } from "../../utils/types/requestValidatorSchema";

export class ClientRequestsController {
  private requestsService = new ClientRequestsService();

  create = async (req: IUserRequest, res: Response) => {
    try {
      const data = createStaffingRequestSchema.parse(req.body);
      const result = await this.requestsService.create(req.userId as string, data);

      res.status(201).json({ message: "Request posted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.requestsService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Requests fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  close = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.requestsService.close(req.userId as string, req.params.reference);

      res.status(200).json({ message: "Request closed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  matches = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.requestsService.matches(req.userId as string, req.params.reference, req.query);

      res.status(200).json({ message: "Matches fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
