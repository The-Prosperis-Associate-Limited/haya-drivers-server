import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface HireRequestEmailData {
  email: string;
  first_name: string;
  event: "INVOICE_READY" | "PAYMENT_CONFIRMED" | "PROOF_REJECTED" | "DRIVER_HIRED";
  reference: string;
  amount?: string;
  reason?: string;
  counterpart?: string;
  date?: string;
  actionUrl: string;
}

const COPY: Record<HireRequestEmailData["event"], { subject: (data: HireRequestEmailData) => string; title: string; body: (data: HireRequestEmailData) => string; buttonText: string }> = {
  INVOICE_READY: {
    subject: data => `Your invoice is ready - ${data.reference}`,
    title: "Your hire invoice is ready",
    body: data =>
      `We've reviewed your hire request ${data.reference} and your invoice is ready. Transfer the total to the account shown on your request, then upload your proof of payment. Your driver's verified contact details unlock the moment we confirm the transfer.`,
    buttonText: "View invoice and pay",
  },
  PAYMENT_CONFIRMED: {
    subject: data => `Payment confirmed - ${data.reference}`,
    title: "Payment confirmed",
    body: data => `We've confirmed your payment for ${data.reference}. ${data.counterpart ?? "Your driver"} is booked, and the verified contact details are now available on your request. Welcome aboard.`,
    buttonText: "View driver details",
  },
  PROOF_REJECTED: {
    subject: data => `We couldn't confirm your payment - ${data.reference}`,
    title: "We couldn't confirm your payment",
    body: data => `Your proof of payment for ${data.reference} was not accepted: ${data.reason ?? "the receipt could not be verified"}. Please upload a valid receipt and we'll take another look right away.`,
    buttonText: "Re-upload proof",
  },
  DRIVER_HIRED: {
    subject: () => "You've been hired",
    title: "You've been hired",
    body: data =>
      `Congratulations - a client has hired you for ${data.counterpart ?? "a new engagement"}${data.date ? ` starting ${data.date}` : ""}. ${data.amount ? `${data.amount} is on its way to your earnings balance. ` : ""}Check the engagement details and be ready for day one.`,
    buttonText: "View engagement",
  },
};

const generateHireRequestData = (data: HireRequestEmailData) => {
  const copy = COPY[data.event];

  return {
    type: data.event === "DRIVER_HIRED" ? ("booking" as const) : ("payment" as const),
    title: copy.title,
    recipientName: data.first_name,
    message: copy.body(data),
    buttonText: copy.buttonText,
    buttonAction: data.actionUrl,
    additionalDetails: {
      reference: data.reference,
      amount: data.amount,
      date: data.date,
    },
  };
};

export const createHireRequestEmail = (data: HireRequestEmailData) => {
  const react = generateProfessionalEmail(generateHireRequestData(data));

  return { react, subject: COPY[data.event].subject(data) };
};

export const sendHireRequestEmail = async (data: HireRequestEmailData): Promise<void> => {
  const { react, subject } = createHireRequestEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
