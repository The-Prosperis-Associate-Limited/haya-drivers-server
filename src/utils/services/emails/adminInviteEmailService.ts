import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface AdminInviteEmailData {
  email: string;
  first_name: string;
  inviter_name: string;
  role_label: string;
  baseUrl: string;
}

// The temporary password is deliberately absent — it is shown to the inviter
// once and shared out-of-band, so this email leaking grants nothing.
const generateAdminInviteData = (data: AdminInviteEmailData) => ({
  type: "verification" as const,
  title: "You've been invited to the Drivers Vault admin console",
  recipientName: data.first_name,
  message: `${data.inviter_name} has invited you to join the Drivers Vault admin console as ${data.role_label}.\n\nYour temporary sign-in credentials will be shared with you securely. You'll be asked to set a new password the first time you sign in.`,
  buttonText: "Sign in to the console",
  buttonAction: `${data.baseUrl}/auth/signin`,
});

export const createAdminInviteEmail = (data: AdminInviteEmailData) => {
  const react = generateProfessionalEmail(generateAdminInviteData(data));

  return { react, subject: "Your Drivers Vault admin invitation" };
};

export const sendAdminInviteEmail = async (data: AdminInviteEmailData): Promise<void> => {
  const { react, subject } = createAdminInviteEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
