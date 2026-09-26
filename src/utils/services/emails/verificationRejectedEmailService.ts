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
  const list = data.documents.map(doc => `${doc.label} — ${doc.reason}`).join("\n");

  return {
    type: "verification_result" as const,
    title: count === 1 ? "We couldn't verify one document" : `We couldn't verify ${count} documents`,
    recipientName: data.first_name,
    message: `The rest of your application looks good. Fix the items below and resubmit — there's no need to redo anything else.\n\n${list}`,
    buttonText: "Resubmit Documents",
    buttonAction: `${data.baseUrl}/onboarding/documents`,
  };
};

export const createVerificationRejectedEmail = (data: VerificationRejectedData) => {
  const react = generateProfessionalEmail(generateVerificationRejectedData(data));

  return { react, subject: "Action needed on your Drivers Vault documents" };
};

export const sendVerificationRejectedEmail = async (data: VerificationRejectedData): Promise<void> => {
  const { react, subject } = createVerificationRejectedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
