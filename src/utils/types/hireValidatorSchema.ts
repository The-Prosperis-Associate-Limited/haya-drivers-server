import z from "zod";

export const createHireRequestSchema = z.object({
  driverId: z.string().min(1, "Pick a driver"),
  engagement_type: z.enum(["MONTHLY", "CONTRACT"]).default("MONTHLY"),
  starts_at: z.coerce.date().refine(value => value >= new Date(new Date().setHours(0, 0, 0, 0)), "The start date cannot be in the past"),
  note: z.string().trim().max(1000).optional(),
});

export const generateInvoiceSchema = z.object({
  // Defaults to the driver's expected monthly rate when omitted.
  amount_minor: z.coerce.number().int().positive("Enter the engagement amount").optional(),
  vat_percent: z.coerce.number().min(0).max(50).optional(),
  note: z.string().trim().max(500).optional(),
});

export const declineHireRequestSchema = z.object({
  reason: z.string().trim().min(5, "Tell the client why this request was declined").max(500),
});

export const hireRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["PENDING_REVIEW", "INVOICED", "PAID", "DECLINED", "CANCELLED"]).optional(),
});

export type CreateHireRequestInput = z.infer<typeof createHireRequestSchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type DeclineHireRequestInput = z.infer<typeof declineHireRequestSchema>;
export type HireRequestListQuery = z.infer<typeof hireRequestListQuerySchema>;
