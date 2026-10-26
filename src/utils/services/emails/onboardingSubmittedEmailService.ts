import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface OnboardingSubmittedData {
  email: string;
  first_name: string;
  baseUrl: string;
}

const generateOnboardingSubmittedData = (data: OnboardingSubmittedData) => ({
  type: "verification" as const,
  title: "Thanks - your documents are in",
  recipientName: data.first_name,
  message: "Our team is going through them now. Verification usually takes 24-48 hours, and we'll email you the moment there's a decision.",
  steps: [
    { title: "Application submitted", body: "Your documents and details are with us.", state: "done" as const },
    { title: "In review", body: "A reviewer checks every document against your details.", state: "current" as const },
    { title: "Decision", body: "Approved and visible to clients, or a note on what to fix." },
  ],
  callout: {
    tone: "info" as const,
    title: "While you wait,",
    body: "start a training module. Each certificate raises your trust score and unlocks more job requests.",
  },
  buttonText: "Go to dashboard",
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
