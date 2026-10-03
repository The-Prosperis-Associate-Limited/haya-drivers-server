import z from "zod";

export const createStaffingRequestSchema = z.object({
  title: z.string().trim().min(3, "Give the request a title"),
  description: z.string().trim().max(600).optional(),
  driver_type: z.enum(["CORPORATE_DRIVER", "PRIVATE_DRIVER", "LOGISTICS_DRIVER", "RIDE_HAILING_DRIVER", "HEAVY_DUTY_DRIVER"]),
  engagement_type: z.enum(["MONTHLY", "CONTRACT"]).optional().default("MONTHLY"),
  country: z.string().trim().min(1).optional().default("Nigeria"),
  state: z.string().trim().min(1, "Select a state"),
  city: z.string().trim().optional(),
  budget: z.coerce.number().positive("Enter a monthly budget"),
  currency: z.string().trim().length(3).toUpperCase().optional().default("NGN"),
  preferred_ethnicity: z.string().trim().max(40).optional(),
  preferred_religion: z.string().trim().max(40).optional(),
  preferred_age_range: z.string().trim().max(20).optional(),
});

export type CreateStaffingRequestInput = z.infer<typeof createStaffingRequestSchema>;
