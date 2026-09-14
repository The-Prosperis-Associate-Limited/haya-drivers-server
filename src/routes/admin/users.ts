import { Router } from "express";
import { AdminUsersController } from "../../controllers/admin/admin.users.controller";
import { requireSuperAdmin } from "../../middleware/adminAccess";

const usersRouter = Router();
const users = new AdminUsersController();

usersRouter.get("/", users.list);
usersRouter.get("/stats", users.stats);
usersRouter.get("/:id", users.get);
usersRouter.get("/:id/wallet", users.wallet);
usersRouter.get("/:id/activities", users.activities);
usersRouter.patch("/:id/suspend", users.suspend);
usersRouter.patch("/:id/reactivate", users.reactivate);
usersRouter.delete("/:id", requireSuperAdmin, users.remove);

export { usersRouter };
