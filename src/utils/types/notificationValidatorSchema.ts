import z from "zod";

export const notificationPreferenceSchema = z.object({
  job_requests: z.boolean().optional(),
  sms_alerts: z.boolean().optional(),
  client_messages: z.boolean().optional(),
  verification_updates: z.boolean().optional(),
  training_reminders: z.boolean().optional(),
  product_news: z.boolean().optional(),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
