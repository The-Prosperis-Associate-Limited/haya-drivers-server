import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface CertificationIssuedEmailData {
  email: string;
  first_name: string;
  courseTitle: string;
  trustScoreReward: number;
  reference: string;
  baseUrl: string;
}

const generateCertificationIssuedData = (data: CertificationIssuedEmailData) => ({
  type: "training" as const,
  title: `${data.courseTitle} - certified`,
  recipientName: data.first_name,
  message: `You have completed ${data.courseTitle}. Your certificate is ready to download, and your trust score went up by ${data.trustScoreReward} points - a higher score puts you in front of more clients.`,
  buttonText: "Download Certificate",
  buttonAction: `${data.baseUrl}/dashboard/training/certifications`,
  additionalDetails: { reference: data.reference },
});

export const createCertificationIssuedEmail = (data: CertificationIssuedEmailData) => {
  const react = generateProfessionalEmail(generateCertificationIssuedData(data));

  return { react, subject: `Your ${data.courseTitle} certificate is ready` };
};

export const sendCertificationIssuedEmail = async (data: CertificationIssuedEmailData): Promise<void> => {
  const { react, subject } = createCertificationIssuedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
