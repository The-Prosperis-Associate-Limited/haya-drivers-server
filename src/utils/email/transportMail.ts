import "dotenv/config";

import { ServerClient } from "postmark";
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

const { SENDER_EMAIL, REPLYTO_EMAIL, POSTMARK_SERVER_TOKEN, RESEND_API_KEY } = process.env;

const isDevelopment = process.env.NODE_ENV === "development";

/*
  Both clients are built on first use, not at import. Postmark throws from its
  constructor on an empty token, so building it eagerly took the whole server
  down on any environment without production email credentials — including every
  local one, where Postmark is never the provider anyway.
*/
let postmark: ServerClient | null = null;
let resend: Resend | null = null;

const getPostmark = () => {
  if (!POSTMARK_SERVER_TOKEN) throw new Error("POSTMARK_SERVER_TOKEN is not set");

  return (postmark ??= new ServerClient(POSTMARK_SERVER_TOKEN));
};

const getResend = () => {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

  return (resend ??= new Resend(RESEND_API_KEY));
};

export async function transportMail(formData: transportMailType) {
  if (isDevelopment) {
    return await getResend().emails.send({
      from: SENDER_EMAIL!,
      to: formData.email,
      subject: formData.subject,
      html: formData.message,
      replyTo: REPLYTO_EMAIL,
      attachments: formData.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
    });
  }

  await getPostmark().sendEmail({
    From: SENDER_EMAIL!,
    To: formData.email,
    Subject: formData.subject,
    HtmlBody: formData.message,
    ReplyTo: REPLYTO_EMAIL,
    Attachments: formData.attachments?.map((a, idx) => ({
      Name: a.filename,
      Content: a.content.toString("base64"),
      ContentType: a.contentType ?? "application/pdf",
      ContentID: `attachment-${idx + 1}`,
    })),
  });
}
