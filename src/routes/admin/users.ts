import { Router } from "express";
import { AdminUsersController } from "../../controllers/admin/admin.users.controller";

const usersRouter = Router();
const users = new AdminUsersController();

usersRouter.get("/", users.list);
usersRouter.get("/:id", users.get);
usersRouter.patch("/:id/suspend", users.suspend);
usersRouter.patch("/:id/reactivate", users.reactivate);
usersRouter.delete("/:id", users.remove);

export { usersRouter };
