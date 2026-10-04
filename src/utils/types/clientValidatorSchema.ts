import z from "zod";

export const clientPreferencesSchema = z.object({
  client_type: z.enum(["INDIVIDUAL", "ORGANISATION"]).optional(),
  organisation_name: z.string().trim().min(2).optional(),
  hiring_categories: z.array(z.enum(["CONTRACT", "PRIVATE", "CORPORATE", "EXECUTIVE", "SPY", "EXPATRIATE"])).optional(),
  drivers_needed: z.enum(["ONE", "TWO_TO_FIVE", "SIX_TO_FIFTEEN", "SIXTEEN_PLUS"]).optional(),
  assignment_type: z.enum(["PERMANENT", "TEMPORARY"]).optional(),
  primary_location: z.string().trim().min(2).optional(),
  hiring_timeline: z.enum(["IMMEDIATELY", "WITHIN_TWO_WEEKS", "THIS_MONTH", "EXPLORING"]).optional(),
  budget_range: z.enum(["RANGE_150_200K", "RANGE_201_250K", "RANGE_251_300K", "RANGE_301K_PLUS"]).optional(),
});

export type ClientPreferencesInput = z.infer<typeof clientPreferencesSchema>;
