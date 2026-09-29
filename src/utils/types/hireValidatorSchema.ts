import z from "zod";

export const createHireRequestSchema = z.object({
  // Omitted = concierge request; an admin assigns the driver at review.
  driverId: z.string().min(1).optional(),
  engagement_type: z.enum(["MONTHLY", "CONTRACT"]).default("MONTHLY"),
  starts_at: z.coerce.date().refine(value => value >= new Date(new Date().setHours(0, 0, 0, 0)), "The start date cannot be in the past"),
  note: z.string().trim().max(1000).optional(),

  package: z.enum(["PRIVATE", "SUBSCRIPTION"]).default("PRIVATE"),
  duration_months: z.coerce.number().int().min(1).max(60).optional(),
  drivers_needed: z.coerce.number().int().min(1).max(50).default(1),
  driver_type: z.enum(["CORPORATE_DRIVER", "PRIVATE_DRIVER", "LOGISTICS_DRIVER", "RIDE_HAILING_DRIVER", "HEAVY_DUTY_DRIVER"]).optional(),
  schedule: z.enum(["WEEKDAYS", "WEEKDAYS_AND_SATURDAY", "FULL_WEEK", "CUSTOM"]).default("WEEKDAYS"),
  resumption_time: z.string().trim().max(20).optional(),
  closing_time: z.string().trim().max(20).optional(),
  transmission: z.enum(["AUTOMATIC", "MANUAL", "BOTH"]).optional(),
  insurance_cover: z.string().trim().max(60).optional(),
  provides_accommodation: z.coerce.boolean().default(false),
  state: z.string().trim().max(60).optional(),
  nearest_area: z.string().trim().max(120).optional(),
});

export const submitProofSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const rejectProofSchema = z.object({
  reason: z.string().trim().min(5, "Tell the client what was wrong with the proof").max(500),
});

export const assignDriverSchema = z.object({
  driverId: z.string().min(1, "Pick a driver"),
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
  status: z.enum(["PENDING_REVIEW", "INVOICED", "PAYMENT_REVIEW", "PAID", "DECLINED", "CANCELLED"]).optional(),
});

export type CreateHireRequestInput = z.infer<typeof createHireRequestSchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type DeclineHireRequestInput = z.infer<typeof declineHireRequestSchema>;
export type HireRequestListQuery = z.infer<typeof hireRequestListQuerySchema>;
export type SubmitProofInput = z.infer<typeof submitProofSchema>;
export type RejectProofInput = z.infer<typeof rejectProofSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
