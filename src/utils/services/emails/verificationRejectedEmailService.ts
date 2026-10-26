import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface RejectedDocument {
  label: string;
  reason: string;
}

export interface VerificationRejectedData {
  email: string;
  first_name: string;
  documents: RejectedDocument[];
  baseUrl: string;
}

const generateVerificationRejectedData = (data: VerificationRejectedData) => {
  const count = data.documents.length;

  return {
    type: "verification_result" as const,
    tone: "warning" as const,
    label: "Action needed",
    title: count === 1 ? "We couldn't verify one document" : `We couldn't verify ${count} documents`,
    recipientName: data.first_name,
    message: "The rest of your application looks good. Fix the items below and resubmit - there's no need to redo anything else.",
    documents: data.documents,
    buttonText: "Resubmit documents",
    buttonAction: `${data.baseUrl}/onboarding/documents`,
    note: "When you resubmit, a reviewer looks at your whole application again, so it may take up to 48 hours.",
  };
};

export const createVerificationRejectedEmail = (data: VerificationRejectedData) => {
  const react = generateProfessionalEmail(generateVerificationRejectedData(data));

  return { react, subject: "Action needed on your Haya Drivers documents" };
};

export const sendVerificationRejectedEmail = async (data: VerificationRejectedData): Promise<void> => {
  const { react, subject } = createVerificationRejectedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
