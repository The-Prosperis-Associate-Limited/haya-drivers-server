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
  title: "Welcome to Haya Drivers",
  recipientName: data.name,
  label: "Welcome",
  message: "Your account is created. Confirm this email address so we can reach you about verification results and job requests.",
  buttonText: "Verify email address",
  buttonAction: `${SERVER_URL}/api/auth/verify-email?token=${data.verificationToken}`,
  steps: [
    { title: "Verify your email", body: "The button above. It takes a second.", state: "current" as const },
    { title: "Finish your profile", body: "Seven short steps: licence, ID, guarantor and work history." },
    { title: "Get verified", body: "Our team reviews your documents within 24-48 hours, then clients can book you." },
  ],
  signoff: "Glad to have you on the road with us,",
});

export const createWelcomeEmail = (data: WelcomeEmailData) => {
  const react = generateProfessionalEmail(generateWelcomeEmailData(data));

  return { react, subject: "Welcome to Haya Drivers - please verify your email" };
};

export const sendWelcomeEmail = async (data: WelcomeEmailData): Promise<void> => {
  const { react, subject } = createWelcomeEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
