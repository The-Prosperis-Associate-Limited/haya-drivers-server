import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminTeamService } from "../../services/admin/admin.team.service";
import { inviteAdminSchema, updateAdminRoleSchema } from "../../utils/types/adminValidatorSchema";

export class AdminTeamController {
  private teamService = new AdminTeamService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.teamService.list(req.query);

      res.status(200).json({ message: "Admins fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  invite = async (req: IUserRequest, res: Response) => {
    try {
      const data = inviteAdminSchema.parse(req.body);

      const result = await this.teamService.invite(req.userId as string, data);

      res.status(201).json({ message: "Invite sent successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updateRole = async (req: IUserRequest, res: Response) => {
    try {
      const data = updateAdminRoleSchema.parse(req.body);

      const result = await this.teamService.updateRole(req.userId as string, req.params.id, data);

      res.status(200).json({ message: "Admin role updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  suspend = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.teamService.setStatus(req.userId as string, req.params.id, "SUSPENDED");

      res.status(200).json({ message: "Admin suspended", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reactivate = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.teamService.setStatus(req.userId as string, req.params.id, "ACTIVE");

      res.status(200).json({ message: "Admin reactivated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  remove = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.teamService.remove(req.userId as string, req.params.id);

      res.status(200).json({ message: "Admin removed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
