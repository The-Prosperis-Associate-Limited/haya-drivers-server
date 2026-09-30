import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface EmailVerifiedData {
  email: string;
  first_name: string;
  baseUrl: string;
}

const generateEmailVerifiedData = (data: EmailVerifiedData) => ({
  type: "verification" as const,
  title: "Email verified",
  recipientName: data.first_name,
  message: "Your email address is confirmed and your account is active. Finish setting up your profile and upload your documents so clients can start booking you.",
  buttonText: "Continue Setup",
  buttonAction: `${data.baseUrl}/onboarding`,
});

export const createEmailVerifiedEmail = (data: EmailVerifiedData) => {
  const react = generateProfessionalEmail(generateEmailVerifiedData(data));

  return { react, subject: "Your Haya Drivers email is verified" };
};

export const sendEmailVerifiedEmail = async (data: EmailVerifiedData): Promise<void> => {
  const { react, subject } = createEmailVerifiedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
