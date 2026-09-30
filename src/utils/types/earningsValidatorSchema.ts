import z from "zod";

export const addBankAccountSchema = z.object({
  bank_code: z.string().trim().min(1, "Select your bank"),
  bank_name: z.string().trim().min(1, "Select your bank"),
  account_number: z
    .string()
    .trim()
    .regex(/^\d{8,20}$/, "Enter a valid account number"),
  account_name: z.string().trim().min(3, "Enter the name on the account").max(100),
  currency: z.string().trim().length(3).toUpperCase().optional().default("NGN"),
  country: z.string().trim().length(2).toUpperCase().optional().default("NG"),
});

export const requestPayoutSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount to withdraw"),
  bankAccountId: z.string().optional(),
});

export const reviewPayoutSchema = z.object({
  status: z.enum(["PROCESSING", "PAID", "FAILED"]),
  failure_reason: z.string().trim().optional(),
});

export type AddBankAccountInput = z.infer<typeof addBankAccountSchema>;
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;
