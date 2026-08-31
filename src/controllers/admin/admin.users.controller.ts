import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminUsersService } from "../../services/admin/admin.users.service";

export class AdminUsersController {
  private usersService = new AdminUsersService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.usersService.list(req.query);

      res.status(200).json({ message: "Users fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.usersService.get(req.params.id);

      res.status(200).json({ message: "User fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  suspend = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.usersService.setAccountStatus(req.params.id, "SUSPENDED", req.body.reason);

      res.status(200).json({ message: "Account suspended", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reactivate = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.usersService.setAccountStatus(req.params.id, "ACTIVE");

      res.status(200).json({ message: "Account reactivated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  remove = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.usersService.remove(req.params.id);

      res.status(200).json({ message: "Account deleted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
