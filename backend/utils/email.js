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

// Helper to parse SMTP_FROM into a proper { name, address }
function parseFromAddress() {
  const smtpFrom = (process.env.SMTP_FROM || '').trim();
  const fallbackAddress = process.env.SMTP_USER || 'dev@example.com';

  if (!smtpFrom) {
    return { name: undefined, address: fallbackAddress };
  }

  // If it already looks like Name <email@domain>
  const angleMatch = smtpFrom.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    const name = angleMatch[1].trim().replace(/^"|"$/g, '') || undefined;
    const address = angleMatch[2].trim();
    return { name, address };
  }

  // If it's a plain email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpFrom)) {
    return { name: undefined, address: smtpFrom };
  }

  // Try to extract last token with @ as address, the rest as name
  const parts = smtpFrom.split(/\s+/);
  const emailToken = parts.reverse().find(t => t.includes('@'));
  if (emailToken) {
    const address = emailToken.replace(/["<>]/g, '');
    const name = smtpFrom.replace(emailToken, '').trim() || undefined;
    return { name, address };
  }

  // Fallback to using it as a name with fallback address
  return { name: smtpFrom, address: fallbackAddress };
}

function isValidEmail(addr) {
  if (!addr || typeof addr !== 'string') return false;
  const a = addr.trim();
  // Simple, pragmatic email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a);
}

async function sendQuoteEmail(quote, pdfPath) {
  const notify = process.env.SMTP_NOTIFY_TO;
  const clientEmail = (quote.clientEmail || '').trim();
  const contactMaybeEmail = (quote.clientContact || '').trim();
  const fallback = (process.env.SMTP_FALLBACK_TO || '').trim();
  let to;
  if (isValidEmail(clientEmail)) {
    to = clientEmail;
  } else if (isValidEmail(contactMaybeEmail)) {
    to = contactMaybeEmail;
  } else if (isValidEmail(fallback)) {
    to = fallback;
  } else if (isValidEmail((notify || '').trim())) {
    to = (notify || '').trim();
  } else {
    to = 'cliente@example.com';
  }
  const fromParsed = parseFromAddress();
  const code6 = (quote.token || '').slice(-6);
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl = `${baseUrl.replace(/\/$/, '')}/accept?file=${quote.quoteNumber}.json&token=${quote.token}`;
  const bccFinal = isValidEmail((notify || '').trim()) && (to !== (notify || '').trim()) ? (notify || '').trim() : undefined;
  const mail = {
    from: fromParsed,
    replyTo: fromParsed.address,
    to,
    bcc: bccFinal,
    envelope: {
      from: process.env.SMTP_USER || fromParsed.address,
      to,
      bcc: bccFinal
    },
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
  const fromParsed = parseFromAddress();
  const notifyTo = process.env.SMTP_NOTIFY_TO || fromParsed.address; // send notification to sender/admin by default
  const mail = {
    from: fromParsed,
    replyTo: fromParsed.address,
    to: notifyTo,
    envelope: {
      from: process.env.SMTP_USER || fromParsed.address,
      to: notifyTo
    },
    subject: `Cotización ${quote.quoteNumber} RECHAZADA`,
    text: `La cotización ${quote.quoteNumber} para ${quote.client || ''} fue rechazada por ${quote.rejectedBy || 'Web'} el ${quote.rejectedAt || ''}.
Motivo: ${quote.rejectedReason || '(sin motivo)'}\n`,
  };
  return transporter.sendMail(mail);
}

module.exports = { sendQuoteEmail, sendRejectionEmail, transporter };
