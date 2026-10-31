import z from "zod";

export const referralCodeField = z.string().trim().min(4, "Enter the referral code").max(20, "That referral code is too long");

export const attachReferralCodeSchema = z.object({
  code: referralCodeField,
});

export const approveReferralSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const rejectReferralSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason the next reviewer can understand").max(500),
});

export type AttachReferralCodeInput = z.infer<typeof attachReferralCodeSchema>;
