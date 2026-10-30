import { z } from "zod";

export const markSalaryPaidSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const disputeSalarySchema = z.object({
  reason: z.string().trim().min(5, "Tell us what happened with this payment").max(500),
});

export const salaryListSchema = z.object({
  status: z.enum(["disputed", "overdue", "awaiting", "all"]).default("disputed"),
});

export const resolveSalarySchema = z.object({
  outcome: z.enum(["PAID", "UNPAID"]),
  note: z.string().trim().min(5, "Add a short note - the client and driver both see it").max(500),
});
