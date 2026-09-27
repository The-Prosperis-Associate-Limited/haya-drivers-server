import z from "zod";

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Type a message first").max(2000, "Keep a message under 2000 characters"),
});

export const chatInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["WAITING", "ACTIVE", "RESOLVED"]).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatInboxQuery = z.infer<typeof chatInboxQuerySchema>;
