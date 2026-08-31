import z from "zod";

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Give your ticket a subject"),
  description: z.string().trim().min(10, "Tell us what happened"),
  category: z.enum(["ACCOUNT", "VERIFICATION", "BOOKING", "PAYMENT", "TRAINING", "BUG_REPORT", "OTHER"]).optional().default("OTHER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
});

export const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().optional(),
});

export const ticketCommentSchema = z.object({
  message: z.string().trim().min(1, "Write a message"),
  is_internal: z.boolean().optional().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketCommentInput = z.infer<typeof ticketCommentSchema>;
