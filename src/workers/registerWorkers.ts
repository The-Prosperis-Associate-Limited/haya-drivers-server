import { BookingRequestEmailData, sendBookingRequestEmail } from "../utils/services/emails/bookingRequestEmailService";
import { AdminInviteEmailData, sendAdminInviteEmail } from "../utils/services/emails/adminInviteEmailService";
import { BookingStatusEmailData, sendBookingStatusEmail } from "../utils/services/emails/bookingStatusEmailService";
import { CertificationIssuedEmailData, sendCertificationIssuedEmail } from "../utils/services/emails/certificationIssuedEmailService";
import { EmailOtpData, sendEmailOtpEmail } from "../utils/services/emails/emailOtpService";
import { EmailVerifiedData, sendEmailVerifiedEmail } from "../utils/services/emails/emailVerifiedEmailService";
import { ForgotPasswordData, sendForgotPasswordEmail } from "../utils/services/emails/forgotPasswordEmailService";
import { OnboardingSubmittedData, sendOnboardingSubmittedEmail } from "../utils/services/emails/onboardingSubmittedEmailService";
import { PayoutStatusEmailData, sendPayoutStatusEmail } from "../utils/services/emails/payoutStatusEmailService";
import { ResetPasswordData, sendResetPasswordEmail } from "../utils/services/emails/resetPasswordEmailService";
import { sendTicketCreatedEmail, sendTicketUpdateEmail, TicketCreatedEmailData, TicketUpdateEmailData } from "../utils/services/emails/ticketEmailService";
import { sendVerificationApprovedEmail, VerificationApprovedData } from "../utils/services/emails/verificationApprovedEmailService";
import { sendVerificationRejectedEmail, VerificationRejectedData } from "../utils/services/emails/verificationRejectedEmailService";
import { sendWelcomeEmail, WelcomeEmailData } from "../utils/services/emails/welcomeEmailService";
import { registerEmailHandler } from "./globalEmailQueueHandler";
import { JOB_KEY } from "./jobKeys";

export const initializeEmailHandlers = function () {
  registerEmailHandler(JOB_KEY.REGISTRATION, async (data: WelcomeEmailData) => await sendWelcomeEmail(data));

  registerEmailHandler(JOB_KEY.EMAIL_VERIFIED, async (data: EmailVerifiedData) => await sendEmailVerifiedEmail(data));

  registerEmailHandler(JOB_KEY.EMAIL_OTP, async (data: EmailOtpData) => await sendEmailOtpEmail(data));

  registerEmailHandler(JOB_KEY.FORGOT_PASSWORD, async (data: ForgotPasswordData) => await sendForgotPasswordEmail(data));

  registerEmailHandler(JOB_KEY.RESET_PASSWORD, async (data: ResetPasswordData) => await sendResetPasswordEmail(data));

  registerEmailHandler(JOB_KEY.ONBOARDING_SUBMITTED, async (data: OnboardingSubmittedData) => await sendOnboardingSubmittedEmail(data));

  registerEmailHandler(JOB_KEY.VERIFICATION_APPROVED, async (data: VerificationApprovedData) => await sendVerificationApprovedEmail(data));

  registerEmailHandler(JOB_KEY.VERIFICATION_REJECTED, async (data: VerificationRejectedData) => await sendVerificationRejectedEmail(data));

  registerEmailHandler(JOB_KEY.BOOKING_REQUEST, async (data: BookingRequestEmailData) => await sendBookingRequestEmail(data));

  registerEmailHandler(JOB_KEY.BOOKING_STATUS, async (data: BookingStatusEmailData) => await sendBookingStatusEmail(data));

  registerEmailHandler(JOB_KEY.PAYOUT_STATUS, async (data: PayoutStatusEmailData) => await sendPayoutStatusEmail(data));

  registerEmailHandler(JOB_KEY.CERTIFICATION_ISSUED, async (data: CertificationIssuedEmailData) => await sendCertificationIssuedEmail(data));

  registerEmailHandler(JOB_KEY.CREATE_TICKET, async (data: TicketCreatedEmailData) => await sendTicketCreatedEmail(data));

  registerEmailHandler(JOB_KEY.UPDATE_TICKET, async (data: TicketUpdateEmailData) => await sendTicketUpdateEmail(data));

  registerEmailHandler(JOB_KEY.ADMIN_INVITE, async (data: AdminInviteEmailData) => await sendAdminInviteEmail(data));
};
