import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { ClientHiresService } from "../../services/client/client.hires.service";

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
}
