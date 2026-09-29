import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface PayoutStatusEmailData {
  email: string;
  first_name: string;
  status: "REQUESTED" | "PAID" | "FAILED";
  amount: string;
  bankName: string;
  accountNumber: string;
  reference: string;
  baseUrl: string;
  failureReason?: string;
}

const COPY: Record<PayoutStatusEmailData["status"], { title: string; body: (data: PayoutStatusEmailData) => string }> = {
  REQUESTED: {
    title: "Withdrawal on its way",
    body: data =>
      `We have received your withdrawal request for ${data.amount}. It is headed to your ${data.bankName} account ending ${data.accountNumber.slice(-4)} and usually lands within one business day.`,
  },
  PAID: {
    title: "Withdrawal paid",
    body: data => `${data.amount} has been sent to your ${data.bankName} account ending ${data.accountNumber.slice(-4)}.`,
  },
  FAILED: {
    title: "Withdrawal failed",
    body: data =>
      `We could not complete your withdrawal of ${data.amount}. ${data.failureReason ?? "Your bank rejected the transfer."}\n\nThe money is back in your available balance - check your account details and try again.`,
  },
};

const generatePayoutStatusData = (data: PayoutStatusEmailData) => {
  const copy = COPY[data.status];

  return {
    type: "payment" as const,
    title: copy.title,
    recipientName: data.first_name,
    message: copy.body(data),
    buttonText: "View Earnings",
    buttonAction: `${data.baseUrl}/dashboard/earnings`,
    additionalDetails: { amount: data.amount, reference: data.reference },
  };
};

export const createPayoutStatusEmail = (data: PayoutStatusEmailData) => {
  const react = generateProfessionalEmail(generatePayoutStatusData(data));

  return { react, subject: COPY[data.status].title };
};

export const sendPayoutStatusEmail = async (data: PayoutStatusEmailData): Promise<void> => {
  const { react, subject } = createPayoutStatusEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
