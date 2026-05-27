import { Resend } from 'resend';

const resendApiKey = process.env.Resend_api_key;
const mailFrom = process.env.MAIL_FROM || 'onboarding@resend.dev';
const mailFromName = process.env.MAIL_FROM_NAME || 'Property Manager';

const buildResendClient = () => {
  if (!resendApiKey) {
    console.warn('[mailer] Resend_api_key environment variable is missing. Mailer will run in log-only mode.');
    return null;
  }

  console.log('[mailer] Initializing Resend client...');
  return new Resend(resendApiKey);
};

const resend = buildResendClient();

export const sendMail = async ({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) => {
  if (!resend) {
    console.warn('[mailer] Resend is not configured. Email content:', { to, subject, text });
    return { skipped: true };
  }

  const fromAddress = mailFrom.includes('@') ? mailFrom : 'onboarding@resend.dev';
  const fromSender = `"${mailFromName}" <${fromAddress}>`;

  try {
    const response = await resend.emails.send({
      from: fromSender,
      to,
      subject,
      html: html || `<p>${text}</p>`
    });

    if (response.error) {
      throw new Error(response.error.message || JSON.stringify(response.error));
    }

    return response.data;
  } catch (error) {
    console.error('[mailer] Resend email delivery failed:', error);
    throw error;
  }
};