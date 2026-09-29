import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface BookingRequestEmailData {
  email: string;
  first_name: string;
  clientName: string;
  title: string;
  date: string;
  time: string;
  location: string;
  amount: string;
  reference: string;
  baseUrl: string;
}

const generateBookingRequestData = (data: BookingRequestEmailData) => ({
  type: "booking" as const,
  title: "New job request",
  recipientName: data.first_name,
  message: `${data.clientName} wants to book you for ${data.title}. Review the details and respond - requests expire if they go unanswered.`,
  buttonText: "View Request",
  buttonAction: `${data.baseUrl}/dashboard/job-request/${data.reference}`,
  additionalDetails: {
    date: data.date,
    time: data.time,
    location: data.location,
    client: data.clientName,
    amount: data.amount,
    reference: data.reference,
  },
});

export const createBookingRequestEmail = (data: BookingRequestEmailData) => {
  const react = generateProfessionalEmail(generateBookingRequestData(data));

  return { react, subject: `New job request from ${data.clientName}` };
};

export const sendBookingRequestEmail = async (data: BookingRequestEmailData): Promise<void> => {
  const { react, subject } = createBookingRequestEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
