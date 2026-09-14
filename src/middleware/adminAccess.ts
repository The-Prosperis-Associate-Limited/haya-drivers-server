import { NextFunction, Response } from "express";
import { AdminRole, IUserRequest } from "../interface";

export type AdminWriteDomain = "users" | "verifications" | "transactions" | "training" | "tickets";

const WRITE_ACCESS: Record<AdminRole, "*" | AdminWriteDomain[]> = {
  SUPER_ADMIN: "*",
  FLEET_MANAGER: ["users", "verifications", "training"],
  FINANCE_OFFICER: ["transactions"],
  SUPPORT_AGENT: ["tickets"],
  READ_ONLY: [],
};

export const guardAdminWrites = (domain: AdminWriteDomain) =>
  function (req: IUserRequest, res: Response, next: NextFunction) {
    if (req.method === "GET" || req.method === "HEAD") return next();

    const allowed = WRITE_ACCESS[req.adminRole ?? "READ_ONLY"];

    if (allowed === "*" || allowed.includes(domain)) return next();

    return res.status(403).json({ message: "Your admin role does not permit changes here" });
  };

export const requireSuperAdmin = function (req: IUserRequest, res: Response, next: NextFunction) {
  if (req.adminRole !== "SUPER_ADMIN") return res.status(403).json({ message: "Only a super admin can do this" });
  next();
};
