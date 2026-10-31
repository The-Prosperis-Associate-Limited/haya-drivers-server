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

export const onboardingInsightsSchema = z.object({
  location: z.string().trim().max(120).optional(),
  budget: z.coerce.number().int().positive().optional(),
  categories: z.preprocess(
    value => (typeof value === "string" && value ? value.split(",") : undefined),
    z.array(z.enum(["CONTRACT", "PRIVATE", "CORPORATE", "EXECUTIVE", "SPY", "EXPATRIATE"])).optional(),
  ),
});

export type OnboardingInsightsInput = z.infer<typeof onboardingInsightsSchema>;
