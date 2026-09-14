import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export type Role = "DRIVER" | "CLIENT" | "ADMIN";

export type AdminRole = "SUPER_ADMIN" | "FLEET_MANAGER" | "FINANCE_OFFICER" | "SUPPORT_AGENT" | "READ_ONLY";

export interface IUserRequest extends Request {
  userId?: string;
  refreshToken?: string;
  role?: Role;
  adminRole?: AdminRole;
  rawBody?: string;
}

export interface CustomJwtPayload extends JwtPayload {
  role: Role;
  id: string;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
