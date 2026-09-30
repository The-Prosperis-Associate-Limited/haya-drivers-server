import { AdminInviteEmailData } from "../utils/services/emails/adminInviteEmailService";
import { BookingStatusEmailData } from "../utils/services/emails/bookingStatusEmailService";
import { CertificationIssuedEmailData } from "../utils/services/emails/certificationIssuedEmailService";
import { EmailOtpData } from "../utils/services/emails/emailOtpService";
import { EmailVerifiedData } from "../utils/services/emails/emailVerifiedEmailService";
import { ForgotPasswordData } from "../utils/services/emails/forgotPasswordEmailService";
import { HireRequestEmailData } from "../utils/services/emails/hireRequestEmailService";
import { OnboardingSubmittedData } from "../utils/services/emails/onboardingSubmittedEmailService";
import { PayoutStatusEmailData } from "../utils/services/emails/payoutStatusEmailService";
import { ResetPasswordData } from "../utils/services/emails/resetPasswordEmailService";
import { TicketCreatedEmailData, TicketUpdateEmailData } from "../utils/services/emails/ticketEmailService";
import { VerificationApprovedData } from "../utils/services/emails/verificationApprovedEmailService";
import { VerificationRejectedData } from "../utils/services/emails/verificationRejectedEmailService";
import { WelcomeEmailData } from "../utils/services/emails/welcomeEmailService";
import { JOB_KEY } from "./jobKeys";

export type EmailPayloadMap = {
  [JOB_KEY.REGISTRATION]: WelcomeEmailData;
  [JOB_KEY.EMAIL_VERIFIED]: EmailVerifiedData;
  [JOB_KEY.EMAIL_OTP]: EmailOtpData;
  [JOB_KEY.FORGOT_PASSWORD]: ForgotPasswordData;
  [JOB_KEY.RESET_PASSWORD]: ResetPasswordData;

  [JOB_KEY.ONBOARDING_SUBMITTED]: OnboardingSubmittedData;
  [JOB_KEY.VERIFICATION_APPROVED]: VerificationApprovedData;
  [JOB_KEY.VERIFICATION_REJECTED]: VerificationRejectedData;

  [JOB_KEY.BOOKING_STATUS]: BookingStatusEmailData;

  [JOB_KEY.HIRE_REQUEST_EVENT]: HireRequestEmailData;

  [JOB_KEY.PAYOUT_STATUS]: PayoutStatusEmailData;

  [JOB_KEY.CERTIFICATION_ISSUED]: CertificationIssuedEmailData;

  [JOB_KEY.CREATE_TICKET]: TicketCreatedEmailData;
  [JOB_KEY.UPDATE_TICKET]: TicketUpdateEmailData;

  [JOB_KEY.ADMIN_INVITE]: AdminInviteEmailData;
};
