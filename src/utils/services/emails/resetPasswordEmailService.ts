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
  tone: "warning" as const,
  label: "Security",
  message: "The password on your Haya Drivers account was just changed. For your security, we signed you out on every other device.",
  callout: {
    tone: "warning" as const,
    title: "Wasn't you?",
    body: "Reset your password again right away from the sign-in screen and contact support.",
  },
  buttonText: "Sign in",
  buttonAction: `${data.baseUrl}/auth/signin`,
  note: "This is a security notification and can't be turned off.",
});

export const createResetPasswordEmail = (data: ResetPasswordData) => {
  const react = generateProfessionalEmail(generateResetPasswordData(data));

  return { react, subject: "Your Haya Drivers password was changed" };
};

export const sendResetPasswordEmail = async (data: ResetPasswordData): Promise<void> => {
  const { react, subject } = createResetPasswordEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
