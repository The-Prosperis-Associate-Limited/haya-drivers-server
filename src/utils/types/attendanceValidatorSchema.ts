import { z } from "zod";

export const attendanceMonthSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must look like 2026-10")
    .optional(),
});

export const attendanceFlagListSchema = z.object({
  status: z.enum(["open", "resolved"]).default("open"),
});

export const resolveAttendanceFlagSchema = z.object({
  outcome: z.enum(["UPHELD", "DISMISSED"]),
  note: z.string().trim().min(5, "Add a short note - the client and driver both see it").max(500),
});

export const flagAttendanceSchema = z.object({
  reason: z.string().trim().min(5, "Tell us what went wrong that day").max(500),
});
