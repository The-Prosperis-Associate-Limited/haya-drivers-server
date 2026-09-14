import { Router } from "express";
import { AdminTeamController } from "../../controllers/admin/admin.team.controller";

const teamRouter = Router();
const team = new AdminTeamController();

teamRouter.get("/", team.list);
teamRouter.post("/invite", team.invite);
teamRouter.patch("/:id/role", team.updateRole);
teamRouter.patch("/:id/suspend", team.suspend);
teamRouter.patch("/:id/reactivate", team.reactivate);
teamRouter.delete("/:id", team.remove);

export { teamRouter };
