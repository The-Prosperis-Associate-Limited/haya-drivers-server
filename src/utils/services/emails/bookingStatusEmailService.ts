import { generateProfessionalEmail } from "../../email/templates/generateProfessionalEmail";
import { transportMail } from "../../email/transportMail";

export interface BookingStatusEmailData {
  email: string;
  first_name: string;
  title: string;
  status: "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED";
  counterpartName: string;
  date: string;
  time: string;
  location: string;
  reference: string;
  baseUrl: string;
  note?: string;
}

const COPY: Record<BookingStatusEmailData["status"], { title: string; body: (data: BookingStatusEmailData) => string }> = {
  ACCEPTED: {
    title: "Booking confirmed",
    body: data => `${data.counterpartName} accepted your request for ${data.title}. You are all set.`,
  },
  DECLINED: {
    title: "Booking declined",
    body: data => `${data.counterpartName} is not available for ${data.title}. You can browse other drivers and send a new request.`,
  },
  CANCELLED: {
    title: "Booking cancelled",
    body: data => `${data.title} with ${data.counterpartName} has been cancelled.`,
  },
  COMPLETED: {
    title: "Job completed",
    body: data => `${data.title} with ${data.counterpartName} is marked complete. Leaving a review helps the next person decide.`,
  },
};

const generateBookingStatusData = (data: BookingStatusEmailData) => {
  const copy = COPY[data.status];

  return {
    type: "booking" as const,
    title: copy.title,
    recipientName: data.first_name,
    message: data.note ? `${copy.body(data)}\n\n${data.note}` : copy.body(data),
    buttonText: "View Booking",
    buttonAction: `${data.baseUrl}/dashboard/job-request/${data.reference}`,
    additionalDetails: {
      date: data.date,
      time: data.time,
      location: data.location,
      reference: data.reference,
    },
  };
};

export const createBookingStatusEmail = (data: BookingStatusEmailData) => {
  const react = generateProfessionalEmail(generateBookingStatusData(data));

  return { react, subject: `${COPY[data.status].title} - ${data.title}` };
};

export const sendBookingStatusEmail = async (data: BookingStatusEmailData): Promise<void> => {
  const { react, subject } = createBookingStatusEmail(data);

  await transportMail({ email: data.email, subject, message: react });
};
