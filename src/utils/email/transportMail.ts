import "dotenv/config";

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

const { RESEND_API_KEY, SENDER_EMAIL, REPLYTO_EMAIL } = process.env;

// Built on first use, not at import - an eager client took the server down
// on any environment missing the API key.
let resend: Resend | null = null;

const getResend = () => {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

  return (resend ??= new Resend(RESEND_API_KEY));
};

export async function transportMail(formData: transportMailType) {
  const { data, error } = await getResend().emails.send({
    from: SENDER_EMAIL ?? "Drivers Vault <noreply@hayadrivers.com>",
    to: formData.email,
    subject: formData.subject,
    html: formData.message,
    replyTo: REPLYTO_EMAIL ?? "support@hayadrivers.com",
    attachments: formData.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  // Resend reports failure as a value; callers expect a throw.
  if (error) throw new Error(`Email delivery failed: ${error.message}`);

  return data;
}
