import "dotenv/config";

import { promises as dns } from "dns";
import nodemailer, { type Transporter } from "nodemailer";

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

const { SENDER_EMAIL, REPLYTO_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

// Built on first use, not at import — an eager transport took the server down
// on any environment missing SMTP credentials.
let smtp: Transporter | null = null;

const getSmtp = async () => {
  if (!SMTP_HOST) throw new Error("SMTP_HOST is not set");

  if (smtp) return smtp;

  const port = Number(SMTP_PORT ?? 587);

  // Node prefers the AAAA record and Render has no IPv6 egress (ENETUNREACH),
  // so connect to a resolved IPv4 address; TLS still validates the hostname.
  const [address] = await dns.resolve4(SMTP_HOST);

  return (smtp = nodemailer.createTransport({
    host: address,
    port,
    // 465 is implicit TLS; every other port negotiates STARTTLS instead.
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    tls: { servername: SMTP_HOST },
  }));
};

// Everything goes through SMTP for now — Resend returns once its key and
// gating are sorted out.
export async function transportMail(formData: transportMailType) {
  const transporter = await getSmtp();

  return await transporter.sendMail({
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
