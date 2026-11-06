import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface OnboardingReminderEmailData {
  email: string;
  first_name: string;
  step_label: string;
  missing_documents: string[];
  final: boolean;
  baseUrl: string;
}

const generateOnboardingReminderData = (data: OnboardingReminderEmailData) => ({
  type: "verification" as const,
  tone: "info" as const,
  label: data.final ? "Last reminder" : "Reminder",
  title: "Finish your Haya Drivers application",
  recipientName: data.first_name,
  message: `You stopped at ${data.step_label}. Clients can only find and hire verified drivers, so finishing your application is what gets you work. Everything you've entered so far is saved.`,
  documents: data.missing_documents.map(label => ({ label, reason: "Still needed" })),
  buttonText: "Continue my application",
  buttonAction: `${data.baseUrl}/onboarding`,
  note: data.final ? "This is our last reminder. Your application stays saved whenever you're ready." : "Verification usually takes 24-48 hours once you submit.",
});

export const createOnboardingReminderEmail = (data: OnboardingReminderEmailData) => {
  const react = generateProfessionalEmail(generateOnboardingReminderData(data));

  return { react, subject: "Your Haya Drivers application is waiting" };
};

export const sendOnboardingReminderEmail = async (data: OnboardingReminderEmailData): Promise<void> => {
  const { react, subject } = createOnboardingReminderEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
