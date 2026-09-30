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

const { CLIENT_APP_URL, SUPPORT_EMAIL } = process.env;

export const generateProfessionalEmail = ({ type = "general" as EmailTypes, title, recipientName, message, buttonText, buttonAction, additionalDetails = {} }: EmailTemplateProps): string => {
  const year = new Date().getFullYear();
  const hasButton = !!(buttonText && buttonAction);
  const hasDetails = Object.values(additionalDetails).some(Boolean);
  const supportEmail = SUPPORT_EMAIL ?? "support@hayadrivers.com";
  const siteUrl = CLIENT_APP_URL ?? "https://hayadrivers.com";

  const accents: Record<EmailTypes, string> = {
    verification: "#2f6bf6",
    verification_result: "#16a34a",
    booking: "#2f6bf6",
    payment: "#16a34a",
    training: "#d97706",
    general: "#2f6bf6",
  };

  const chipBackgrounds: Record<EmailTypes, string> = {
    verification: "#eff6ff",
    verification_result: "#f0fdf4",
    booking: "#eff6ff",
    payment: "#f0fdf4",
    training: "#fffbeb",
    general: "#eff6ff",
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
  const chipBg = chipBackgrounds[type] ?? chipBackgrounds.general;
  const safeMessage = message.replace(/\n/g, "<br>");
  // The hidden line inbox lists show next to the subject.
  const preheader = message.replace(/\s+/g, " ").slice(0, 120);

  const detailEntries = [
    ["Date", additionalDetails.date],
    ["Time", additionalDetails.time],
    ["Location", additionalDetails.location],
    ["Client", additionalDetails.client],
    ["Amount", additionalDetails.amount],
    ["Reference", additionalDetails.reference],
  ].filter(([, value]) => value) as [string, string][];

  const detailRow = ([label, value]: [string, string], index: number) => {
    const border = index === detailEntries.length - 1 ? "" : "border-bottom:1px solid #eef2f7;";

    return `
              <tr>
                <td style="padding:11px 20px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;width:120px;vertical-align:top;${border}">${label}</td>
                <td style="padding:11px 20px 11px 0;font-size:14px;font-weight:600;color:#0f172a;${border}">${value}</td>
              </tr>`;
  };

  const detailsBlock = hasDetails
    ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td style="background-color:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:5px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${detailEntries.map(detailRow).join("")}
                </table>
              </td>
            </tr>
          </table>`
    : "";

  const buttonBlock = hasButton
    ? `
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:32px 0 0;">
            <tr>
              <td align="center">
                <a href="${buttonAction}" style="display:inline-block;padding:14px 44px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;background-color:${accent};border-radius:10px;">${buttonText}</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:16px;">
                <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.6;">
                  Button not working? Copy this link into your browser:<br>
                  <a href="${buttonAction}" style="color:#64748b;text-decoration:underline;word-break:break-all;">${buttonAction}</a>
                </p>
              </td>
            </tr>
          </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f6;">
    <tr>
      <td align="center" style="padding:36px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Brand band -->
                <tr>
                  <td bgcolor="#2f6bf6" style="background-color:#2f6bf6;background-image:linear-gradient(135deg,#2f6bf6 0%,#1e4cbf 100%);padding:26px 40px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:40px;height:40px;background-color:#ffffff;border-radius:10px;text-align:center;vertical-align:middle;">
                          <span style="font-size:15px;font-weight:800;color:#2f6bf6;letter-spacing:0.02em;">HD</span>
                        </td>
                        <td style="padding-left:12px;">
                          <a href="${siteUrl}" style="font-size:19px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Haya Drivers</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px;">

                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:${chipBg};border-radius:999px;padding:5px 14px;">
                          <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:${accent};text-transform:uppercase;">${labels[type] ?? labels.general}</span>
                        </td>
                      </tr>
                    </table>

                    <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:20px 0 0;line-height:1.3;">${title}</h1>

                    <p style="font-size:15px;color:#334155;margin:24px 0 0;line-height:1.75;">Hi <strong>${recipientName}</strong>,</p>
                    <p style="font-size:15px;color:#475569;margin:10px 0 0;line-height:1.75;">${safeMessage}</p>

                    ${detailsBlock}
                    ${buttonBlock}

                  </td>
                </tr>

                <!-- Help strip -->
                <tr>
                  <td style="padding:22px 40px;background-color:#f8fafc;border-top:1px solid #eef2f7;">
                    <p style="font-size:13px;color:#64748b;margin:0;line-height:1.6;">
                      Questions? Reply to this email or write to
                      <a href="mailto:${supportEmail}" style="color:#2f6bf6;text-decoration:none;font-weight:600;">${supportEmail}</a>
                      &mdash; a real person answers.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0;">
              <p style="font-size:13px;font-weight:700;color:#475569;margin:0;letter-spacing:0.02em;">Haya Drivers</p>
              <p style="font-size:12px;color:#94a3b8;margin:8px 0 0;line-height:1.7;">
                Vetted drivers, verified before they reach you.<br>
                Lagos, Nigeria
              </p>
              <p style="font-size:12px;margin:14px 0 0;">
                <a href="${siteUrl}" style="color:#64748b;text-decoration:underline;">Website</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/terms" style="color:#64748b;text-decoration:underline;">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/privacy" style="color:#64748b;text-decoration:underline;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${supportEmail}" style="color:#64748b;text-decoration:underline;">Support</a>
              </p>
              <p style="font-size:12px;color:#cbd5e1;margin:14px 0 0;">
                You're receiving this because you have a Haya Drivers account.<br>
                &copy; ${year} Haya Drivers. All rights reserved.
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
