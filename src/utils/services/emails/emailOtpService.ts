import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface EmailOtpData {
  email: string;
  first_name: string;
  code: string;
  expiresInMinutes: number;
  purpose?: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
}

const COPY = {
  EMAIL_VERIFICATION: {
    title: "Your verification code",
    subject: (code: string) => `${code} is your Haya Drivers verification code`,
    lead: "Enter this code to confirm it's you:",
  },
  PASSWORD_RESET: {
    title: "Your password reset code",
    subject: (code: string) => `${code} is your Haya Drivers password reset code`,
    lead: "Enter this code to choose a new password:",
  },
} as const;

const generateEmailOtpData = (data: EmailOtpData) => {
  const copy = COPY[data.purpose ?? "EMAIL_VERIFICATION"];

  return {
    type: "verification" as const,
    title: copy.title,
    recipientName: data.first_name,
    message: `${copy.lead}\n\n${data.code}\n\nThe code expires in ${data.expiresInMinutes} minutes. If you didn't ask for it, you can ignore this email.`,
  };
};

export const createEmailOtpEmail = (data: EmailOtpData) => {
  const react = generateProfessionalEmail(generateEmailOtpData(data));

  return { react, subject: COPY[data.purpose ?? "EMAIL_VERIFICATION"].subject(data.code) };
};

export const sendEmailOtpEmail = async (data: EmailOtpData): Promise<void> => {
  const { react, subject } = createEmailOtpEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
