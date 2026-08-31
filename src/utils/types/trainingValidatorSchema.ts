import z from "zod";

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Give the course a title"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  summary: z.string().trim().optional(),
  cover_image: z.string().url().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().default("DRAFT"),
  trust_score_reward: z.coerce.number().int().min(0).max(30).optional().default(0),
  certificate_validity_months: z.coerce.number().int().min(1).max(120).optional(),
  estimated_minutes: z.coerce.number().int().min(0).optional().default(0),
});

export const updateCourseSchema = createCourseSchema.partial();

export const createModuleSchema = z.object({
  title: z.string().trim().min(3, "Give the module a title"),
  description: z.string().trim().optional(),
  video_url: z.string().url().optional(),
  content: z.string().optional(),
  duration_minutes: z.coerce.number().int().min(0).optional().default(0),
  position: z.coerce.number().int().min(1).optional(),
});

export const updateModuleSchema = createModuleSchema.partial();

export const moduleProgressSchema = z.object({
  completed: z.boolean().optional().default(true),
  minutes_spent: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type ModuleProgressInput = z.infer<typeof moduleProgressSchema>;
