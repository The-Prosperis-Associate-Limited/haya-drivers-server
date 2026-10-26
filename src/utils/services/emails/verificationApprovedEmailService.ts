import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface VerificationApprovedData {
  email: string;
  first_name: string;
  location: string;
  baseUrl: string;
}

const generateVerificationApprovedData = (data: VerificationApprovedData) => ({
  type: "verification_result" as const,
  title: `You're verified, ${data.first_name}`,
  recipientName: data.first_name,
  message: `Your documents cleared review. Your profile is now visible to clients across ${data.location}, and you'll start receiving job requests here and in the app.`,
  label: "Verified",
  buttonText: "Go to dashboard",
  buttonAction: `${data.baseUrl}/dashboard`,
  signoff: "Welcome aboard,",
});

export const createVerificationApprovedEmail = (data: VerificationApprovedData) => {
  const react = generateProfessionalEmail(generateVerificationApprovedData(data));

  return { react, subject: "You're verified on Haya Drivers" };
};

export const sendVerificationApprovedEmail = async (data: VerificationApprovedData): Promise<void> => {
  const { react, subject } = createVerificationApprovedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
