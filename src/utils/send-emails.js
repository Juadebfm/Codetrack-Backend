import nodemailer from "nodemailer";
import { environment } from "../config/environment.js";

const smtpPort = Number(environment.mailtrapPort || 587);

const transport = nodemailer.createTransport({
  host: environment.mailtrapHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: environment.mailtrapUser,
    pass: environment.mailtrapPassword,
  },
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function createEmailContent(subject, linkText, link) {
  const isPasswordReset = subject.toLowerCase().includes("reset");
  const title = isPasswordReset ? "Reset your password" : "Verify your email";
  const introduction = isPasswordReset
    ? "We received a request to reset the password for your CodeTrack account. Use the button below to choose a new password."
    : "Thanks for joining CodeTrack. Confirm your email address to finish setting up your account.";
  const expiry = isPasswordReset
    ? "For your security, this link expires in 15 minutes."
    : "For your security, this link expires in 24 hours.";
  const safeLink = escapeHtml(link);
  const safeLinkText = escapeHtml(linkText);
  const safeTitle = escapeHtml(title);
  const safeIntroduction = escapeHtml(introduction);
  const safeExpiry = escapeHtml(expiry);

  const text = [
    `CodeTrack: ${title}`,
    "",
    introduction,
    "",
    `${linkText}:`,
    link,
    "",
    expiry,
    "If you did not request this, you can ignore this email.",
    "",
    "The CodeTrack team",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safeIntroduction}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fb;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 0 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;border-radius:12px;background-color:#0f766e;color:#ffffff;font-size:20px;font-weight:bold;">C</td>
                    <td style="padding-left:12px;color:#172033;font-size:20px;font-weight:bold;">CodeTrack</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;background-color:#ffffff;border:1px solid #e5eaf1;border-radius:16px;">
                <p style="margin:0 0 12px;color:#0f766e;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">CodeTrack account</p>
                <h1 style="margin:0 0 16px;color:#172033;font-size:28px;line-height:1.25;">${safeTitle}</h1>
                <p style="margin:0 0 24px;color:#526078;font-size:16px;line-height:1.6;">${safeIntroduction}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#0f766e;">
                      <a href="${safeLink}" style="display:inline-block;padding:14px 22px;border:1px solid #0f766e;border-radius:8px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">${safeLinkText}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#667085;font-size:13px;line-height:1.6;">${safeExpiry}</p>
                <p style="margin:0;color:#667085;font-size:13px;line-height:1.6;">If the button doesn’t work, copy and paste this link into your browser:</p>
                <p style="margin:8px 0 0;word-break:break-all;font-size:13px;line-height:1.6;"><a href="${safeLink}" style="color:#0f766e;">${safeLink}</a></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 16px 0;color:#7b8495;font-size:12px;line-height:1.6;">
                If you did not request this, you can ignore this email.<br>
                The CodeTrack team
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendEmail(to, subject, linkText, link) {
  if (environment.nodeEnv === "test") return;

  const { text, html } = createEmailContent(subject, linkText, link);

  await transport.sendMail({
    from: {
      name: environment.mailFromName || "CodeTrack",
      address: environment.mailFromEmail,
    },
    to,
    subject,
    text,
    html,
  });
}