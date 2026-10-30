export const JOB_KEY = {
  REGISTRATION: "welcome_email",
  EMAIL_VERIFIED: "email_verified",
  EMAIL_OTP: "email_otp",
  FORGOT_PASSWORD: "forgot_password",
  RESET_PASSWORD: "reset_password",

  ONBOARDING_SUBMITTED: "onboarding_submitted",
  VERIFICATION_APPROVED: "verification_approved",
  VERIFICATION_REJECTED: "verification_rejected",

  BOOKING_STATUS: "booking_status",

  HIRE_REQUEST_EVENT: "hire_request_event",

  PAYOUT_STATUS: "payout_status",

  CERTIFICATION_ISSUED: "certification_issued",

  CREATE_TICKET: "create_ticket",
  UPDATE_TICKET: "update_ticket",

  ADMIN_INVITE: "admin_invite",
} as const;

// Must stay in step with the repeatable definitions in utils/cron-jobs.ts
export const SCHEDULED_JOB_KEY = {
  RELEASE_PENDING_EARNINGS: "release_pending_earnings",
  EXPIRE_SHORTLISTS: "expire_shortlists",
  SALARY_SWEEP: "salary_sweep",
  LICENCE_EXPIRY_SWEEP: "licence_expiry_sweep",
  DELETE_UNVERIFIED_ACCOUNTS: "delete_unverified_accounts",
  RECOMPUTE_TRUST_SCORES: "recompute_trust_scores",
  DEACTIVATE_INACTIVE_ACCOUNTS: "deactivate_inactive_accounts",
} as const;
