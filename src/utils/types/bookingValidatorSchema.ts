import z from "zod";

export const createBookingSchema = z
  .object({
    driverId: z.string().min(1, "Choose a driver"),
    title: z.string().trim().min(3, "Give the job a title"),
    description: z.string().trim().optional(),
    requirements: z.array(z.string().trim().min(1)).max(10).optional().default([]),
    driver_type: z.enum(["CORPORATE_DRIVER", "PRIVATE_DRIVER", "LOGISTICS_DRIVER", "RIDE_HAILING_DRIVER", "HEAVY_DUTY_DRIVER"]),
    engagement_type: z.enum(["ONE_OFF", "DAILY", "WEEKLY", "MONTHLY", "CONTRACT"]).optional().default("ONE_OFF"),
    pickup_address: z.string().trim().min(3, "Enter a pickup address"),
    dropoff_address: z.string().trim().optional(),
    country: z.string().trim().min(1, "Select a country"),
    state: z.string().trim().min(1, "Select a state"),
    city: z.string().trim().optional(),
    starts_at: z.coerce.date(),
    ends_at: z.coerce.date().optional(),
    // Major units on the wire, minor units in the database. The service does
    // the conversion so no caller has to remember which side it is on.
    amount: z.coerce.number().positive("Enter what you are paying for this job"),
    currency: z.string().trim().length(3).toUpperCase().optional().default("NGN"),
  })
  .superRefine((data, ctx) => {
    if (data.starts_at < new Date()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The start time is in the past", path: ["starts_at"] });
    }

    if (data.ends_at && data.ends_at < data.starts_at) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The end time cannot come before the start time", path: ["ends_at"] });
    }
  });

// The bucket names, not raw statuses — booking.repository owns which statuses
// each one covers, so the list and the summary cannot drift apart.
export const jobRequestFilterSchema = z.object({
  bucket: z.enum(["open", "accepted", "declined"]).optional(),
});

export const declineBookingSchema = z.object({
  reason: z.string().trim().min(3, "Let the client know why"),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for the cancellation"),
});

export const reviewBookingSchema = z.object({
  rating: z.coerce.number().int().min(1, "Give a rating between 1 and 5").max(5, "Give a rating between 1 and 5"),
  comment: z.string().trim().max(1000).optional(),
});

export const driverSearchSchema = z.object({
  search: z.string().trim().optional(),
  driver_type: z.enum(["CORPORATE_DRIVER", "PRIVATE_DRIVER", "LOGISTICS_DRIVER", "RIDE_HAILING_DRIVER", "HEAVY_DUTY_DRIVER"]).optional(),
  vehicle_class: z.enum(["SALOON", "SUV", "BUS", "TRUCK", "TRAILER", "MOTORCYCLE"]).optional(),
  country: z.string().trim().optional(),
  state: z.string().trim().optional(),
  min_trust_score: z.coerce.number().int().min(0).max(100).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type JobRequestFilterInput = z.infer<typeof jobRequestFilterSchema>;
export type ReviewBookingInput = z.infer<typeof reviewBookingSchema>;
export type DriverSearchInput = z.infer<typeof driverSearchSchema>;
