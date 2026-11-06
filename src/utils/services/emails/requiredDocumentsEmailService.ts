import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export type RequiredDocumentsEmailKind = "announcement" | "reminder" | "deadline_passed";

export interface RequiredDocumentsEmailData {
  email: string;
  first_name: string;
  kind: RequiredDocumentsEmailKind;
  documents: { label: string; reason: string }[];
  verified: boolean;
  due_at: string | null;
  baseUrl: string;
}

const listOf = (documents: { label: string }[]) => {
  const labels = documents.map(document => document.label);

  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

const deadlineLine = (data: RequiredDocumentsEmailData) => (data.due_at ? `Upload ${data.documents.length === 1 ? "it" : "them"} by ${data.due_at} to keep your verified badge and stay visible to clients.` : `Your application can't be approved until ${data.documents.length === 1 ? "it's" : "they're"} uploaded.`);

const generateRequiredDocumentsData = (data: RequiredDocumentsEmailData) => {
  const documents = listOf(data.documents);
  const base = { recipientName: data.first_name, documents: data.documents, buttonAction: `${data.baseUrl}/onboarding/documents` };

  if (data.kind === "deadline_passed") {
    return {
      ...base,
      type: "verification_result" as const,
      tone: "danger" as const,
      label: "Verification paused",
      title: "Your verified badge is paused",
      message: `We didn't receive your ${documents} before the deadline, so your profile is hidden from clients for now. Upload ${data.documents.length === 1 ? "it" : "them"} and resubmit - your other documents are kept.`,
      buttonText: "Upload and resubmit",
      note: "Once you resubmit, a reviewer looks at your application again, usually within 48 hours.",
    };
  }

  if (data.kind === "reminder") {
    return {
      ...base,
      type: "verification" as const,
      tone: "warning" as const,
      label: "Reminder",
      title: `Your ${documents} ${data.documents.length === 1 ? "is" : "are"} still missing`,
      message: data.verified ? deadlineLine(data) : `Every driver needs a ${documents} on file. ${deadlineLine(data)}`,
      buttonText: "Upload now",
    };
  }

  return {
    ...base,
    type: "verification" as const,
    tone: "warning" as const,
    label: "Action needed",
    title: `We now need your ${documents}`,
    message: `Every Haya Drivers driver now needs a ${documents} on file alongside their other documents - it helps our verification team confirm your work history. ${deadlineLine(data)}`,
    buttonText: "Upload now",
    note: "PDF or Word, up to 5 MB. A clear photo of a printed copy also works.",
  };
};

export const createRequiredDocumentsEmail = (data: RequiredDocumentsEmailData) => {
  const react = generateProfessionalEmail(generateRequiredDocumentsData(data));
  const subject = data.kind === "deadline_passed" ? "Your Haya Drivers verification is paused" : `Action needed: upload your ${listOf(data.documents)}`;

  return { react, subject };
};

export const sendRequiredDocumentsEmail = async (data: RequiredDocumentsEmailData): Promise<void> => {
  const { react, subject } = createRequiredDocumentsEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
