import "dotenv/config";

import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface transportMailType {
  email: string;
  subject: string;
  message: any;
  attachments?: Attachment[];
}

const { SENDER_EMAIL, REPLYTO_EMAIL, RESEND_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

/*
  Both clients are built on first use, not at import. A provider constructed
  eagerly took the whole server down on any environment missing that provider's
  credentials — including every local one, where Resend is never the transport
  anyway. Building lazily keeps the failure inside the send, where the email
  queue already retries and logs it.
*/
let smtp: Transporter | null = null;
let resend: Resend | null = null;

const getSmtp = () => {
  if (!SMTP_HOST) throw new Error("SMTP_HOST is not set");

  const port = Number(SMTP_PORT ?? 587);

  return (smtp ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // 465 is implicit TLS; every other port negotiates STARTTLS instead.
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  }));
};

const getResend = () => {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

  return (resend ??= new Resend(RESEND_API_KEY));
};

export async function transportMail(formData: transportMailType) {
  // Provider is chosen by available credentials, not NODE_ENV — a prod dyno
  // mislabelled "development" must never try SMTP, which Render can't route.
  if (!RESEND_API_KEY) {
    return await getSmtp().sendMail({
      from: SENDER_EMAIL!,
      to: formData.email,
      subject: formData.subject,
      html: formData.message,
      replyTo: REPLYTO_EMAIL,
      attachments: formData.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  }

  await getResend().emails.send({
    from: SENDER_EMAIL!,
    to: formData.email,
    subject: formData.subject,
    html: formData.message,
    replyTo: REPLYTO_EMAIL,
    attachments: formData.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}
