import z from "zod";

const adminRoleField = z.enum(["SUPER_ADMIN", "FLEET_MANAGER", "FINANCE_OFFICER", "SUPPORT_AGENT", "READ_ONLY"]);

export const inviteAdminSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the admin's full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  admin_role: adminRoleField,
});

export const updateAdminRoleSchema = z.object({
  admin_role: adminRoleField,
});

export const growthPeriodSchema = z.object({
  period: z.enum(["7d", "14d", "30d"]).optional().default("14d"),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
export type UpdateAdminRoleInput = z.infer<typeof updateAdminRoleSchema>;
