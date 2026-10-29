import type { $Enums } from "../generated/prisma/client";

export type PreferenceKey = "job_requests" | "client_messages" | "verification_updates" | "training_reminders" | "product_news";

// Money, warnings and account security have no switch - only these categories follow the recipient's settings.
export const PREFERENCE_FOR: Partial<Record<$Enums.NotificationType, PreferenceKey>> = {
  BOOKING_REQUEST: "job_requests",
  BOOKING_STATUS: "job_requests",
  MESSAGE: "client_messages",
  VERIFICATION: "verification_updates",
  DOCUMENT_REVIEW: "verification_updates",
  TRAINING: "training_reminders",
};

// Mirrors the column defaults in notification.prisma, for users who have never opened their settings.
export const PREFERENCE_DEFAULTS: Record<PreferenceKey, boolean> = {
  job_requests: true,
  client_messages: true,
  verification_updates: true,
  training_reminders: false,
  product_news: false,
};
