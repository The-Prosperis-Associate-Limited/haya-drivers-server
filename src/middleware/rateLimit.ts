import { rateLimit } from "express-rate-limit";

/*
  Per-IP throttles for the unauthenticated auth surface. Two tiers: credential
  attempts get room for genuine retries; anything that sends an email is much
  tighter because every request costs a real Resend send and an attacker can
  drain the quota (or bomb a victim's inbox) with a loop. In-memory stores are
  fine on a single instance - swap in a Redis store if the API ever scales out.
*/

const options = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
} as const;

export const credentialLimiter = rateLimit({
  ...options,
  limit: 20,
  message: { message: "Too many attempts. Please wait a few minutes and try again." },
});

export const emailSendLimiter = rateLimit({
  ...options,
  limit: 5,
  message: { message: "Too many requests. Please wait a few minutes before requesting another email." },
});
