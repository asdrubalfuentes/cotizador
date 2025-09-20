const nodemailer = require('nodemailer');
const path = require('path');

// SMTP configuration with sensible defaults and env overrides
const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = Number(process.env.SMTP_PORT || 1025);
// If SMTP_SECURE is provided, honor it; otherwise infer: secure true for 465
const smtpSecure = process.env.SMTP_SECURE !== undefined
  ? /^true|1|yes$/i.test(String(process.env.SMTP_SECURE))
  : smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined,
  connectionTimeout: Number(process.env.SMTP_CONN_TIMEOUT || 15000), // ms
  greetingTimeout: Number(process.env.SMTP_GREET_TIMEOUT || 10000), // ms
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000), // ms
  tls: process.env.SMTP_TLS_REJECT_UNAUTH === 'false'
    ? { rejectUnauthorized: false }
    : undefined,
  logger: /^true|1|yes$/i.test(String(process.env.SMTP_DEBUG || '')),
  debug: /^true|1|yes$/i.test(String(process.env.SMTP_DEBUG || ''))
});

async function sendQuoteEmail(quote, pdfPath) {
  const to = quote.clientEmail || quote.clientContact || process.env.SMTP_FALLBACK_TO || 'cliente@example.com';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'dev@example.com';
  const code6 = (quote.token || '').slice(-6);
  const mail = {
    from,
    to,
    subject: `Cotización ${quote.quoteNumber}`,
    text: `Adjunto PDF y código de aceptación: ${code6}`,
    attachments: [
      { filename: path.basename(pdfPath), path: pdfPath }
    ]
  };
  return transporter.sendMail(mail);
}

module.exports = { sendQuoteEmail, transporter };
