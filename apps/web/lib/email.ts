/**
 * Email sending via MailerSend.
 * Currently used for transactional emails from the Next.js side.
 * Preview report emails are sent by the Python worker (services/analyzer).
 */

const MAILERSEND_API_URL = "https://api.mailersend.com/v1/email";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<void> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@visiblee.ai";

  if (!apiKey) {
    throw new Error("MAILERSEND_API_KEY is not configured");
  }

  const response = await fetch(MAILERSEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: from, name: "Visiblee" },
      to: [{ email: to }],
      subject,
      html,
    }),
  });

  if (!response.ok && response.status !== 202) {
    const body = await response.text();
    throw new Error(`MailerSend error ${response.status}: ${body}`);
  }
}
