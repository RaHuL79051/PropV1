import nodemailer from 'nodemailer';

const mailerMode = (process.env.MAIL_MAILER || process.env.SMTP_MAILER || 'maildev').toLowerCase();

const mailHost = process.env.MAIL_HOST || process.env.SMTP_HOST || '127.0.0.1';
const mailPort = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 1025);
const mailUser = process.env.MAIL_USERNAME || process.env.SMTP_USER || undefined;
const mailPass = process.env.MAIL_PASSWORD || process.env.SMTP_PASS || undefined;
const mailFrom = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_FROM || mailUser || 'no-reply@proptenant.local';
const mailFromName = process.env.MAIL_FROM_NAME || 'Property Manager';


const buildTransporter = () => {
  if (mailerMode === 'log') {
    console.log('[mailer] SMTP mailer mode is set to "log". Emails will only be logged to the console.');
    return null;
  }

  // Local maildev or direct local testing
  if (mailHost === '127.0.0.1' || mailHost === 'localhost') {
    console.log(`[mailer] Initializing local SMTP transporter: host=${mailHost}, port=${mailPort}, user=${mailUser || 'none'}`);
    return nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: false,
      ignoreTLS: true,
      auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined
    });
  }

  // Real SMTP server (like Brevo, Gmail, SES, etc.)
  const secure = mailPort === 465 || process.env.MAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true';
  console.log(`[mailer] Initializing production SMTP transporter: host=${mailHost}, port=${mailPort}, user=${mailUser || 'none'}, secure=${secure}`);
  return nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure,
    auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined,
    // Explicitly demand TLS upgrades on submission port 587
    requireTLS: mailPort === 587
  });
};

const transporter = buildTransporter();

export const sendMail = async ({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) => {
  if (!transporter) {
    console.warn('[mailer] SMTP is not configured. Email content:', { to, subject, text });
    return { skipped: true };
  }

  return transporter.sendMail({
    from: `"${mailFromName}" <${mailFrom}>`,
    to,
    subject,
    text,
    html
  });
};