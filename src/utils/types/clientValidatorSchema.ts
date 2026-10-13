import z from "zod";

export const clientPreferencesSchema = z.object({
  client_type: z.enum(["INDIVIDUAL", "ORGANISATION"]).optional(),
  organisation_name: z.string().trim().min(2).optional(),
  hiring_categories: z.array(z.enum(["CONTRACT", "PRIVATE", "CORPORATE", "EXECUTIVE", "SPY", "EXPATRIATE"])).optional(),
  drivers_needed: z.enum(["ONE", "TWO_TO_FIVE", "SIX_TO_FIFTEEN", "SIXTEEN_PLUS"]).optional(),
  assignment_type: z.enum(["PERMANENT", "TEMPORARY"]).optional(),
  primary_location: z.string().trim().min(2).optional(),
  hiring_timeline: z.enum(["IMMEDIATELY", "WITHIN_TWO_WEEKS", "THIS_MONTH", "EXPLORING"]).optional(),
  monthly_budget: z.number().int().positive().optional(),
});

export type ClientPreferencesInput = z.infer<typeof clientPreferencesSchema>;
