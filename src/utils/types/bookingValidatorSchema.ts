import z from "zod";

// The bucket names, not raw statuses - booking.repository owns which statuses
// each one covers, so the list and the summary cannot drift apart.
export const jobRequestFilterSchema = z.object({
  bucket: z.enum(["active", "completed"]).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for the cancellation"),
});

export const REVIEW_CRITERIA = ["Reliability", "Professionalism", "Driving skill & safety", "Route knowledge", "Vehicle care"] as const;

const starScore = z.coerce.number().int().min(1, "Give a rating between 1 and 5").max(5, "Give a rating between 1 and 5");

// Either a single overall rating, or the per-aspect breakdown the hire review
// form collects - the service averages the breakdown into `rating`.
export const reviewBookingSchema = z
  .object({
    rating: starScore.optional(),
    criteria: z.record(z.enum(REVIEW_CRITERIA), starScore).optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rating === undefined && !Object.keys(data.criteria ?? {}).length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate at least one aspect", path: ["rating"] });
    }
  });

export const driverSearchSchema = z.object({
  search: z.string().trim().optional(),
  driver_type: z.enum(["CORPORATE_DRIVER", "PRIVATE_DRIVER", "LOGISTICS_DRIVER", "RIDE_HAILING_DRIVER", "HEAVY_DUTY_DRIVER"]).optional(),
  licence_class: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "J"]).optional(),
  country: z.string().trim().optional(),
  state: z.string().trim().optional(),
  city: z.string().trim().optional(),
  // Minor units. A driver with no expected rate is never filtered out - an
  // unknown rate is not the same as an unaffordable one.
  budget_min: z.coerce.number().int().min(0).optional(),
  budget_max: z.coerce.number().int().min(0).optional(),
  min_trust_score: z.coerce.number().int().min(0).max(100).optional(),
});

export type JobRequestFilterInput = z.infer<typeof jobRequestFilterSchema>;
export type ReviewBookingInput = z.infer<typeof reviewBookingSchema>;
export type DriverSearchInput = z.infer<typeof driverSearchSchema>;
