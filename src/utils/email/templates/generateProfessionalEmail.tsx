export type EmailTypes = "verification" | "booking" | "payment" | "verification_result" | "training" | "general";

interface EmailTemplateProps {
  type: EmailTypes;
  title: string;
  recipientName: string;
  message: string;
  buttonText?: string;
  buttonAction?: string;
  additionalDetails?: {
    date?: string;
    time?: string;
    location?: string;
    client?: string;
    amount?: string;
    reference?: string;
  };
}

const { CLIENT_URL, SUPPORT_EMAIL } = process.env;

export const generateProfessionalEmail = ({ type = "general" as EmailTypes, title, recipientName, message, buttonText, buttonAction, additionalDetails = {} }: EmailTemplateProps): string => {
  const year = new Date().getFullYear();
  const hasButton = !!(buttonText && buttonAction);
  const hasDetails = Object.values(additionalDetails).some(Boolean);
  const supportEmail = SUPPORT_EMAIL ?? "support@hayadrivers.com";

  const accents: Record<EmailTypes, string> = {
    verification: "#2f6bf6",
    verification_result: "#1a8754",
    booking: "#2f6bf6",
    payment: "#1a8754",
    training: "#b5650a",
    general: "#334155",
  };

  const labels: Record<EmailTypes, string> = {
    verification: "Verification",
    verification_result: "Verification",
    booking: "Booking",
    payment: "Payment",
    training: "Training",
    general: "Notification",
  };

  const accent = accents[type] ?? accents.general;
  const safeMessage = message.replace(/\n/g, "<br>");

  const detailRow = (label: string, value?: string) =>
    value
      ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:110px;vertical-align:top;">${label}</td>
              <td style="padding:6px 0;font-size:14px;color:#334155;">${value}</td>
            </tr>`
      : "";

  const detailsBlock = hasDetails
    ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
          <tr><td style="padding:16px 0;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${detailRow("Date", additionalDetails.date)}
              ${detailRow("Time", additionalDetails.time)}
              ${detailRow("Location", additionalDetails.location)}
              ${detailRow("Client", additionalDetails.client)}
              ${detailRow("Amount", additionalDetails.amount)}
              ${detailRow("Reference", additionalDetails.reference)}
            </table>
          </td></tr>
        </table>`
    : "";

  const buttonBlock = hasButton
    ? `
        <table cellpadding="0" cellspacing="0" border="0" style="margin:32px auto 0;">
          <tr>
            <td style="border-radius:8px;background-color:${accent};">
              <a href="${buttonAction}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${buttonText}</a>
            </td>
          </tr>
        </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <tr>
            <td align="center" style="padding-bottom:28px;">
              <a href="${CLIENT_URL ?? "#"}" style="font-size:20px;font-weight:700;letter-spacing:0.14em;color:#0f172a;text-decoration:none;">Drivers Vault</a>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:40px 36px;">

              <p style="font-size:12px;font-weight:600;letter-spacing:0.06em;color:${accent};text-transform:uppercase;margin:0 0 14px;">
                ${labels[type] ?? labels.general}
              </p>

              <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 18px;line-height:1.35;">${title}</h1>

              <p style="font-size:15px;color:#475569;margin:0 0 4px;line-height:1.7;">Hi ${recipientName},</p>
              <p style="font-size:15px;color:#475569;margin:0;line-height:1.7;">${safeMessage}</p>

              ${detailsBlock}
              ${buttonBlock}

            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 0 4px;">
              <p style="font-size:13px;color:#94a3b8;margin:0;">
                Need help? <a href="mailto:${supportEmail}" style="color:#475569;text-decoration:underline;">${supportEmail}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 0 0;">
              <p style="font-size:12px;color:#cbd5e1;margin:0;">
                &copy; ${year} Drivers Vault &middot; <a href="${CLIENT_URL ?? "#"}/privacy-policy" style="color:#94a3b8;text-decoration:underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
