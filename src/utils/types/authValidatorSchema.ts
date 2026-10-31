import z from "zod";
import { isDisposableEmailDomain } from "../emailDomain";
import { referralCodeField } from "./referralValidatorSchema";

// Mirrors the four rules the signup screen lists under the password field.
const passwordValidationRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+.])[A-Za-z\d@$!%*?&#^()\-_=+.]{8,}$/;

const DISPOSABLE_EMAIL_MESSAGE = "Temporary or disposable email addresses are not accepted. Please use a permanent address.";

/*
  Rejects DISPOSABLE domains only, never public providers like Gmail. A
  disposable mailbox is not durable, so a verification result cannot be relied
  on to reach the driver. A Gmail address is real, and most drivers have one.
*/
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address")
  .refine(value => !isDisposableEmailDomain(value), { message: DISPOSABLE_EMAIL_MESSAGE });

const passwordField = z.string().min(8, "Password must be at least 8 characters long").regex(passwordValidationRegex, "Password must include at least one letter, one number and one special character");

const otpCodeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your email");

export const registerValidationSchema = z
  .object({
    full_name: z.string().trim().min(2, "Please enter your full name"),
    email: emailField,
    password: passwordField,
    confirm_password: z.string().optional(),
    role: z.enum(["DRIVER", "CLIENT"]),
    phone_no: z.string().trim().optional(),
    accepted_terms: z.boolean(),
    // Client accounts choose what they hire as; organisation_name doubles as
    // full_name on the organisation tab, so it only exists there.
    client_type: z.enum(["INDIVIDUAL", "ORGANISATION"]).optional(),
    organisation_name: z.string().trim().optional(),
    // Decides how the account proves its email: "web" sends the link, "mobile"
    // sends a code, because a link that opens the web app cannot finish a
    // signup still on screen in the app.
    client: z.enum(["web", "mobile"]).optional().default("web"),
    referral_code: z.preprocess(value => (typeof value === "string" && !value.trim() ? undefined : value), referralCodeField.optional()),
  })
  .superRefine((data, ctx) => {
    if (data.accepted_terms !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "You must accept the Terms of Service and Privacy Policy", path: ["accepted_terms"] });
    }

    if (data.confirm_password && data.confirm_password !== data.password) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords do not match", path: ["confirm_password"] });
    }
  });

export const loginValidationSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirm_password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.confirm_password && data.confirm_password !== data.password) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords do not match", path: ["confirm_password"] });
    }
  });

export const updatePasswordSchema = z.object({
  current_password: z.string().min(1, "Your current password is required"),
  new_password: passwordField,
});

export const sendEmailOtpSchema = z.object({ email: emailField });

export const verifyEmailOtpSchema = z.object({ email: emailField, code: otpCodeField });

export const sendPasswordResetOtpSchema = z.object({ email: emailField });

export const verifyPasswordResetOtpSchema = z.object({ email: emailField, code: otpCodeField });

export const googleNativeSignInSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
  role: z.enum(["driver", "client"]).optional().default("driver"),
});

export const updateProfileSchema = z.object({
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  phone_no: z.string().trim().optional(),
  whatsapp_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Enter the number in international format, e.g. +2348012345678")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  date_of_birth: z.coerce.date().optional(),
  marital_status: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  country: z.string().trim().optional(),
  state_of_residence: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
});

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1, "Push token is required"),
  platform: z.enum(["IOS", "ANDROID"]).optional(),
  deviceName: z.string().optional(),
});

export const unregisterDeviceTokenSchema = z.object({
  token: z.string().min(1, "Push token is required"),
});

export type RegisterInput = z.infer<typeof registerValidationSchema>;
export type LoginInput = z.infer<typeof loginValidationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SendEmailOtpInput = z.infer<typeof sendEmailOtpSchema>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema>;
export type GoogleNativeSignInInput = z.infer<typeof googleNativeSignInSchema>;
export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;
