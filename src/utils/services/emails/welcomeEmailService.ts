import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

const { SERVER_URL } = process.env;

export interface WelcomeEmailData {
  email: string;
  name: string;
  verificationToken: string;
}

const generateWelcomeEmailData = (data: WelcomeEmailData) => ({
  type: "verification" as const,
  title: "Welcome to Drivers Vault",
  recipientName: data.name,
  message:
    "Your account is created. One more step: confirm this email address so we can reach you about verification results and job requests.\n\nVerification takes 24-48 hours once you've uploaded your documents.",
  buttonText: "Verify Email Address",
  buttonAction: `${SERVER_URL}/api/auth/verify-email?token=${data.verificationToken}`,
});

export const createWelcomeEmail = (data: WelcomeEmailData) => {
  const react = generateProfessionalEmail(generateWelcomeEmailData(data));

  return { react, subject: "Welcome to Drivers Vault — please verify your email" };
};

export const sendWelcomeEmail = async (data: WelcomeEmailData): Promise<void> => {
  const { react, subject } = createWelcomeEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
