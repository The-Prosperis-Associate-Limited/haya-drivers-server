import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface OnboardingSubmittedData {
  email: string;
  first_name: string;
  baseUrl: string;
}

const generateOnboardingSubmittedData = (data: OnboardingSubmittedData) => ({
  type: "verification" as const,
  title: "Thank you for the submission",
  recipientName: data.first_name,
  message: "Our team is going through your documents now and will get back to you shortly. Verification usually takes 24-48 hours.\n\nWhile you wait, you can start a training module - completed courses raise your trust score and unlock more job requests.",
  buttonText: "Proceed to Dashboard",
  buttonAction: `${data.baseUrl}/dashboard`,
});

export const createOnboardingSubmittedEmail = (data: OnboardingSubmittedData) => {
  const react = generateProfessionalEmail(generateOnboardingSubmittedData(data));

  return { react, subject: "We've received your documents" };
};

export const sendOnboardingSubmittedEmail = async (data: OnboardingSubmittedData): Promise<void> => {
  const { react, subject } = createOnboardingSubmittedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
