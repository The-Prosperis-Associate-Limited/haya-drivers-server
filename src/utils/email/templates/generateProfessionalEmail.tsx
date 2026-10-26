export type EmailTypes = "verification" | "booking" | "payment" | "verification_result" | "training" | "general";

export type EmailTone = "info" | "success" | "warning" | "danger";

export interface EmailStep {
  title: string;
  body: string;
  state?: "done" | "current" | "upcoming";
}

export interface EmailDocumentIssue {
  label: string;
  reason: string;
}

interface EmailTemplateProps {
  type: EmailTypes;
  title: string;
  recipientName: string;
  message: string;
  buttonText?: string;
  buttonAction?: string;
  tone?: EmailTone;
  label?: string;
  code?: string;
  codeHint?: string;
  amount?: { label: string; value: string; meta?: string };
  documents?: EmailDocumentIssue[];
  steps?: EmailStep[];
  callout?: { tone: EmailTone; title: string; body: string };
  note?: string;
  signoff?: string;
  additionalDetails?: {
    date?: string;
    time?: string;
    location?: string;
    client?: string;
    amount?: string;
    reference?: string;
  };
}

const { CLIENT_APP_URL, SUPPORT_EMAIL, EMAIL_LOGO_URL } = process.env;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const INK = "#0f172a";
const MUTED = "#475569";
const SUBTLE = "#64748b";
const LINE = "#e2e8f0";
const LINE_SOFT = "#eef2f7";
const PANEL = "#f8fafc";
const CANVAS = "#f1f4f9";

const TONES: Record<EmailTone, { accent: string; stripe: string; tint: string; border: string; button: string }> = {
  info: { accent: "#2f6bf6", stripe: "#2f6bf6", tint: "#eef4ff", border: "#d6e3ff", button: "#2f6bf6" },
  success: { accent: "#047857", stripe: "#047857", tint: "#ecfdf5", border: "#c6f0dd", button: "#047857" },
  warning: { accent: "#b45309", stripe: "#f59e0b", tint: "#fff7ed", border: "#fed7aa", button: "#2f6bf6" },
  danger: { accent: "#b42318", stripe: "#f04438", tint: "#fef3f2", border: "#fddcd8", button: "#2f6bf6" },
};

const TYPE_TONES: Record<EmailTypes, EmailTone> = {
  verification: "info",
  verification_result: "success",
  booking: "info",
  payment: "info",
  training: "success",
  general: "info",
};

const TYPE_LABELS: Record<EmailTypes, string> = {
  verification: "Verification",
  verification_result: "Verification",
  booking: "Booking",
  payment: "Payment",
  training: "Training",
  general: "Notification",
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const paragraphs = (text: string, style: string) =>
  text
    .split(/\n\s*\n/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => `<p style="${style}">${escapeHtml(chunk).replace(/\n/g, "<br>")}</p>`)
    .join("");

const panel = (inner: string, { background = "#ffffff", border = LINE_SOFT, margin = "24px 0 0" } = {}) => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${margin};border-collapse:separate;">
            <tr>
              <td style="background-color:${background};border:1px solid ${border};border-radius:12px;">${inner}</td>
            </tr>
          </table>`;

const codeBlock = (code: string, hint?: string) => {
  const digits = code.split("");
  const split = digits.length === 6 ? 3 : -1;
  const cells = digits
    .map((digit, index) => {
      const gap = index === split ? `<td style="width:10px;font-size:0;line-height:0;">&nbsp;</td>` : "";

      return `${gap}<td style="padding:0 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="46" height="58" style="width:46px;height:58px;background-color:${PANEL};border:1px solid ${LINE};border-radius:10px;font-family:${MONO};font-size:28px;font-weight:700;color:${INK};">${escapeHtml(digit)}</td></tr></table></td>`;
    })
    .join("");

  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>
            ${hint ? `<tr><td align="center" style="padding:12px 0 0;font-size:13px;line-height:20px;color:${SUBTLE};">${escapeHtml(hint)}</td></tr>` : ""}
          </table>`;
};

const amountBlock = (amount: NonNullable<EmailTemplateProps["amount"]>, tone: EmailTone) =>
  panel(
    `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td align="center" style="padding:22px 18px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${SUBTLE};">${escapeHtml(amount.label)}</td></tr>
                  <tr><td align="center" style="padding:4px 18px ${amount.meta ? "0" : "22px"};font-size:34px;line-height:42px;font-weight:700;letter-spacing:-0.02em;color:${INK};">${escapeHtml(amount.value)}</td></tr>
                  ${amount.meta ? `<tr><td align="center" style="padding:4px 18px 22px;font-size:13px;color:${MUTED};">${escapeHtml(amount.meta)}</td></tr>` : ""}
                </table>`,
    { background: TONES[tone].tint, border: TONES[tone].tint },
  );

const detailsBlock = (entries: [string, string][]) =>
  panel(
    `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${entries
                    .map(([label, value], index) => {
                      const border = index === entries.length - 1 ? "" : `border-bottom:1px solid ${LINE_SOFT};`;
                      const mono = label === "Reference" ? `font-family:${MONO};font-weight:500;font-size:13px;` : "";

                      return `<tr>
                    <td class="hd-detail-k" valign="top" style="padding:12px 18px;width:120px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${SUBTLE};${border}">${escapeHtml(label)}</td>
                    <td class="hd-detail-v" valign="top" style="padding:12px 18px 12px 0;font-size:14px;font-weight:600;color:${INK};${mono}${border}">${escapeHtml(value)}</td>
                  </tr>`;
                    })
                    .join("")}
                </table>`,
    { background: PANEL },
  );

const stepsBlock = (steps: EmailStep[]) =>
  panel(`
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${steps
                    .map((step, index) => {
                      const state = step.state ?? "upcoming";
                      const marker =
                        state === "done"
                          ? { bg: "#047857", fg: "#ffffff", text: "&#10003;" }
                          : state === "current"
                            ? { bg: "#2f6bf6", fg: "#ffffff", text: String(index + 1) }
                            : { bg: "#eef4ff", fg: "#2f6bf6", text: String(index + 1) };
                      const border = index === steps.length - 1 ? "" : `border-bottom:1px solid ${LINE_SOFT};`;

                      return `<tr>
                    <td valign="top" width="58" style="width:58px;padding:14px 0 14px 16px;${border}">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="26" height="26" style="width:26px;height:26px;border-radius:13px;background-color:${marker.bg};color:${marker.fg};font-size:12px;font-weight:700;">${marker.text}</td></tr></table>
                    </td>
                    <td valign="top" style="padding:14px 16px 14px 0;${border}">
                      <p style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${INK};">${escapeHtml(step.title)}</p>
                      <p style="margin:2px 0 0;font-size:13px;line-height:19px;color:${MUTED};">${escapeHtml(step.body)}</p>
                    </td>
                  </tr>`;
                    })
                    .join("")}
                </table>`);

const documentsBlock = (documents: EmailDocumentIssue[]) =>
  documents
    .map(
      (doc, index) =>
        panel(
          `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="top" width="62" style="width:62px;padding:14px 0 14px 16px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="32" height="32" style="width:32px;height:32px;border-radius:8px;background-color:#fef3f2;color:#b42318;font-size:16px;font-weight:700;">&#10005;</td></tr></table>
                    </td>
                    <td valign="top" style="padding:14px 16px 14px 0;">
                      <p style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${INK};">${escapeHtml(doc.label)}</p>
                      <p style="margin:3px 0 0;font-size:13px;line-height:19px;color:${MUTED};">${escapeHtml(doc.reason)}</p>
                    </td>
                  </tr>
                </table>`,
          { background: "#fffbfa", border: "#fddcd8", margin: index === 0 ? "24px 0 0" : "10px 0 0" },
        ),
    )
    .join("");

const calloutBlock = (callout: NonNullable<EmailTemplateProps["callout"]>) => {
  const tone = TONES[callout.tone];

  return panel(
    `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:14px 16px;font-size:14px;line-height:21px;color:${INK};"><strong style="color:${tone.accent};">${escapeHtml(callout.title)}</strong> ${escapeHtml(callout.body)}</td>
                  </tr>
                </table>`,
    { background: tone.tint, border: tone.border, margin: "22px 0 0" },
  );
};

export const generateProfessionalEmail = ({
  type = "general" as EmailTypes,
  title,
  recipientName,
  message,
  buttonText,
  buttonAction,
  tone: toneOverride,
  label,
  code,
  codeHint,
  amount,
  documents,
  steps,
  callout,
  note,
  signoff,
  additionalDetails = {},
}: EmailTemplateProps): string => {
  const year = new Date().getFullYear();
  const supportEmail = SUPPORT_EMAIL ?? "support@hayadrivers.com";
  const siteUrl = CLIENT_APP_URL ?? "https://hayadrivers.com";
  const logoUrl = EMAIL_LOGO_URL ?? "https://www.hayadrivers.com/icons/icon-192.png";
  const toneKey = toneOverride ?? TYPE_TONES[type] ?? "info";
  const tone = TONES[toneKey];
  const eyebrow = label ?? TYPE_LABELS[type] ?? TYPE_LABELS.general;
  const hasButton = !!(buttonText && buttonAction);
  // The hidden line inbox lists show next to the subject.
  const preheader = escapeHtml(message.replace(/\s+/g, " ").slice(0, 120));

  const detailEntries = [
    ["Date", additionalDetails.date],
    ["Time", additionalDetails.time],
    ["Location", additionalDetails.location],
    ["Client", additionalDetails.client],
    ["Amount", amount ? undefined : additionalDetails.amount],
    ["Reference", additionalDetails.reference],
  ].filter(([, value]) => value) as [string, string][];

  const bodyStyle = `margin:14px 0 0;font-size:15px;line-height:24px;color:${MUTED};`;

  const buttonBlock = hasButton
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td class="hd-btn" align="center" bgcolor="${tone.button}" style="background-color:${tone.button};border-radius:10px;">
                <a href="${escapeHtml(buttonAction!)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(buttonText!)}</a>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;line-height:18px;color:${SUBTLE};">
            Button not working? Paste this link into your browser:<br>
            <a href="${escapeHtml(buttonAction!)}" target="_blank" style="color:${MUTED};text-decoration:underline;word-break:break-all;">${escapeHtml(buttonAction!)}</a>
          </p>`
    : "";

  const blocks = [
    code ? codeBlock(code, codeHint) : "",
    amount ? amountBlock(amount, toneKey) : "",
    documents?.length ? documentsBlock(documents) : "",
    callout ? calloutBlock(callout) : "",
    detailEntries.length ? detailsBlock(detailEntries) : "",
    steps?.length ? stepsBlock(steps) : "",
  ].join("");

  const signoffBlock = signoff
    ? `<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${LINE_SOFT};font-size:14px;line-height:22px;color:${MUTED};">${escapeHtml(signoff)}<br><strong style="color:${INK};">The Haya Drivers team</strong></p>`
    : "";

  const noteBlock = note ? `<p style="margin:20px 0 0;font-size:12px;line-height:18px;color:${SUBTLE};">${escapeHtml(note)}</p>` : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a { color:inherit; }
    @media only screen and (max-width:620px) {
      .hd-outer { padding:20px 10px 32px !important; }
      .hd-body { padding:26px 20px 28px !important; }
      .hd-title { font-size:21px !important; line-height:28px !important; }
      .hd-detail-k, .hd-detail-v { display:block !important; width:auto !important; }
      .hd-detail-k { padding:12px 16px 0 !important; border-bottom:0 !important; }
      .hd-detail-v { padding:2px 16px 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CANVAS};">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CANVAS}" style="background-color:${CANVAS};">
    <tr>
      <td class="hd-outer" align="center" style="padding:36px 16px 48px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FONT};">

          <tr>
            <td style="padding:0 4px 18px;">
              <a href="${siteUrl}" target="_blank" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="background-color:#ffffff;border:1px solid ${LINE};border-radius:9px;padding:3px;">
                      <img src="${logoUrl}" width="28" height="28" alt="Haya Drivers" style="display:block;width:28px;height:28px;border:0;outline:none;">
                    </td>
                    <td valign="middle" style="padding-left:10px;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:${INK};">Haya Drivers</td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="4" bgcolor="${tone.stripe}" style="height:4px;background-color:${tone.stripe};font-size:0;line-height:0;border-radius:14px 14px 0 0;">&nbsp;</td></tr>
                <tr>
                  <td class="hd-body" style="padding:32px 36px 34px;">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:${tone.tint};border-radius:999px;padding:5px 11px;font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${tone.accent};">${escapeHtml(eyebrow)}</td>
                      </tr>
                    </table>

                    <h1 class="hd-title" style="margin:16px 0 0;font-size:24px;line-height:31px;font-weight:700;letter-spacing:-0.015em;color:${INK};">${escapeHtml(title)}</h1>

                    <p style="${bodyStyle}">Hi <strong style="color:${INK};">${escapeHtml(recipientName)}</strong>,</p>
                    ${paragraphs(message, bodyStyle)}

                    ${blocks}
                    ${buttonBlock}
                    ${noteBlock}
                    ${signoffBlock}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 16px 0;font-size:12px;line-height:19px;color:${SUBTLE};">
              <p style="margin:0;font-weight:600;color:${MUTED};">Haya Drivers &middot; Verified professional drivers</p>
              <p style="margin:4px 0 0;">Questions? Reply to this email or write to <a href="mailto:${supportEmail}" style="color:${MUTED};text-decoration:underline;">${supportEmail}</a>.</p>
              <p style="margin:8px 0 0;">
                <a href="${siteUrl}" target="_blank" style="color:${MUTED};text-decoration:underline;">Website</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/privacy" target="_blank" style="color:${MUTED};text-decoration:underline;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/terms" target="_blank" style="color:${MUTED};text-decoration:underline;">Terms</a>
              </p>
              <p style="margin:12px 0 0;color:#94a3b8;">You're receiving this because you have a Haya Drivers account.<br>&copy; ${year} Haya Drivers</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
