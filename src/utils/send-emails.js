import { MailtrapClient } from "mailtrap";
import { environment } from "../config/environment";

// This utility has one job: send an already prepared wmail through MailTrap
export async function sendEmail(to, subject, linkText, link) {
  if (environment.nodeEnv === "test") return;

  const client = new MailtrapClient({ token: environment.mailtrapToken });

  await client.send({
    from: { email: environment.mailFromEmail, name: environment.mailFromName },
    to: [{ email: to }],
    subject: "CodeTrack",
    text: `${linkText}: ${link}`,
    html: `<p><a href="${link}">${linkText}</a></p>`,
  });
}
