import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface ForgotPasswordData {
  email: string;
  first_name: string;
  baseUrl: string;
  resetToken: string;
}

const generateForgotPasswordData = (data: ForgotPasswordData) => ({
  type: "verification" as const,
  title: "Reset your password",
  recipientName: data.first_name,
  message: "Use the button below to choose a new password. The link is valid for 10 minutes.\n\nIf you didn't ask for this, ignore this email — your password stays as it is.",
  buttonText: "Reset Password",
  buttonAction: `${data.baseUrl}/auth/reset-password?token=${data.resetToken}`,
});

export const createForgotPasswordEmail = (data: ForgotPasswordData) => {
  const react = generateProfessionalEmail(generateForgotPasswordData(data));

  return { react, subject: "Reset your Drivers Vault password" };
};

export const sendForgotPasswordEmail = async (data: ForgotPasswordData): Promise<void> => {
  const { react, subject } = createForgotPasswordEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
