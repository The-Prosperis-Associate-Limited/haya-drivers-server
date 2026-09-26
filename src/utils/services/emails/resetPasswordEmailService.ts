import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface ResetPasswordData {
  email: string;
  first_name: string;
  baseUrl: string;
}

const generateResetPasswordData = (data: ResetPasswordData) => ({
  type: "verification" as const,
  title: "Your password was changed",
  recipientName: data.first_name,
  message: "Your password has been changed successfully. For security, we signed you out on every other device.\n\nIf this wasn't you, reset your password again immediately and contact support.",
  buttonText: "Sign In",
  buttonAction: `${data.baseUrl}/auth/signin`,
});

export const createResetPasswordEmail = (data: ResetPasswordData) => {
  const react = generateProfessionalEmail(generateResetPasswordData(data));

  return { react, subject: "Your Drivers Vault password was changed" };
};

export const sendResetPasswordEmail = async (data: ResetPasswordData): Promise<void> => {
  const { react, subject } = createResetPasswordEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
