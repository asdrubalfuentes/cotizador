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
  const notify = process.env.SMTP_NOTIFY_TO;
  const to = quote.clientEmail || quote.clientContact || notify || process.env.SMTP_FALLBACK_TO || 'cliente@example.com';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'dev@example.com';
  const code6 = (quote.token || '').slice(-6);
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl = `${baseUrl.replace(/\/$/, '')}/accept?file=${quote.quoteNumber}.json&token=${quote.token}`;
  const mail = {
    from,
    to,
    bcc: notify || undefined,
    subject: `Cotización ${quote.quoteNumber}`,
    text: `Adjunto PDF y código de aceptación: ${code6}\n\nPuede aceptar o rechazar en: ${acceptUrl}`,
    html: `<p>Adjunto PDF y código de aceptación: <strong>${code6}</strong></p><p>Puede aceptar o rechazar en: <a href="${acceptUrl}">${acceptUrl}</a></p>`,
    attachments: [
      { filename: path.basename(pdfPath), path: pdfPath }
    ]
  };
  return transporter.sendMail(mail);
}

async function sendRejectionEmail(quote) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'dev@example.com';
  const notifyTo = process.env.SMTP_NOTIFY_TO || from; // send notification to sender/admin by default
  const mail = {
    from,
    to: notifyTo,
    subject: `Cotización ${quote.quoteNumber} RECHAZADA`,
    text: `La cotización ${quote.quoteNumber} para ${quote.client || ''} fue rechazada por ${quote.rejectedBy || 'Web'} el ${quote.rejectedAt || ''}.
Motivo: ${quote.rejectedReason || '(sin motivo)'}\n`,
  };
  return transporter.sendMail(mail);
}

module.exports = { sendQuoteEmail, sendRejectionEmail, transporter };
