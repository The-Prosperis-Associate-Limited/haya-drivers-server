import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface TicketCreatedEmailData {
  email: string;
  first_name: string;
  subject_line: string;
  reference: string;
  baseUrl: string;
}

export interface TicketUpdateEmailData extends TicketCreatedEmailData {
  status: string;
  message: string;
}

const generateTicketCreatedData = (data: TicketCreatedEmailData) => ({
  type: "general" as const,
  title: "We have your message",
  recipientName: data.first_name,
  message: `Your ticket "${data.subject_line}" is with our support team. We will reply here as soon as someone has looked at it.`,
  buttonText: "View Ticket",
  buttonAction: `${data.baseUrl}/dashboard/support/${data.reference}`,
  additionalDetails: { reference: data.reference },
});

const generateTicketUpdateData = (data: TicketUpdateEmailData) => ({
  type: "general" as const,
  title: "Update on your ticket",
  recipientName: data.first_name,
  message: `"${data.subject_line}" is now ${data.status.toLowerCase().replace(/_/g, " ")}.\n\n${data.message}`,
  buttonText: "View Ticket",
  buttonAction: `${data.baseUrl}/dashboard/support/${data.reference}`,
  additionalDetails: { reference: data.reference },
});

export const createTicketCreatedEmail = (data: TicketCreatedEmailData) => ({
  react: generateProfessionalEmail(generateTicketCreatedData(data)),
  subject: `Ticket ${data.reference} received`,
});

export const createTicketUpdateEmail = (data: TicketUpdateEmailData) => ({
  react: generateProfessionalEmail(generateTicketUpdateData(data)),
  subject: `Update on ticket ${data.reference}`,
});

export const sendTicketCreatedEmail = async (data: TicketCreatedEmailData): Promise<void> => {
  const { react, subject } = createTicketCreatedEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};

export const sendTicketUpdateEmail = async (data: TicketUpdateEmailData): Promise<void> => {
  const { react, subject } = createTicketUpdateEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
