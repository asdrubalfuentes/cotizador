const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR } = require('../lib/storage');
const { formatNumberDot } = require('./number');

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

function composeCompanyBlock(quote) {
  try {
    const empresas = JSON.parse(fs.readFileSync(path.join(OUTPUTS_DIR, 'empresas.json'), 'utf8')) || [];
    const company = empresas.find(emp => emp.id === quote.companyId) || {};
    const logo = company.logo ? `<div style="margin-top:8px"><img alt="logo" src="cid:companyLogo" style="max-height:48px"/></div>` : '';
    return {
      html:
        `<div style="margin-top:16px;border-top:1px solid #eee;padding-top:8px;font-size:12px;color:#666">
          <div><strong>${company.name || ''}</strong></div>
          ${company.email ? `<div>${company.email}</div>` : ''}
          ${company.address ? `<div>${company.address}</div>` : ''}
          ${logo}
        </div>`,
      attachments: company.logo ? [{
        filename: path.basename(company.logo),
        path: path.join(OUTPUTS_DIR, 'logos', company.logo),
        cid: 'companyLogo'
      }] : []
    };
  } catch { return { html: '', attachments: [] }; }
}

function buildQuoteSummaryHTML(quote) {
  const rows = [
    ['Cotización', quote.quoteNumber],
    ['Cliente', quote.client || ''],
    ['Moneda', quote.currency || 'CLP'],
  ['Total', `${formatNumberDot(quote.total, quote.currency === 'CLP' ? 0 : 1)} ${quote.currency || 'CLP'}`],
    quote.currency && quote.currency !== 'CLP' && (quote.totalInCLP || quote.currencyRate)
  ? ['Equivalente CLP', `${formatNumberDot(quote.totalInCLP || Math.round(Number(quote.total||0) * Number(quote.currencyRate||0)), 0)} CLP (factor: ${formatNumberDot(quote.currencyRate || 0, 1)})`]
      : null,
    ['Creada', quote.created_at || quote.createdAt || ''],
    ['Actualizada', quote.saved_at || quote.savedAt || ''],
  ].filter(Boolean);
  const trs = rows.map(([k,v])=>`<tr><td style="padding:4px 8px;color:#555">${k}</td><td style="padding:4px 8px"><strong>${v}</strong></td></tr>`).join('');
  return `<table style="border-collapse:collapse;font-size:14px">${trs}</table>`;
}

function resolveClientTo(quote) {
  const clientEmail = (quote.clientEmail || '').trim();
  const contactMaybeEmail = (quote.clientContact || '').trim();
  const fallback = (process.env.SMTP_FALLBACK_TO || '').trim();
  if (isValidEmail(clientEmail)) return clientEmail;
  if (isValidEmail(contactMaybeEmail)) return contactMaybeEmail;
  if (isValidEmail(fallback)) return fallback;
  return undefined;
}

function resolveCompanyTo(defaultTo) {
  const notify = (process.env.SMTP_NOTIFY_TO || '').trim();
  return isValidEmail(notify) ? notify : defaultTo;
}

function baseMail(fromParsed, to, bcc) {
  return {
    from: fromParsed,
    replyTo: fromParsed.address,
    to,
    bcc,
    envelope: {
      from: process.env.SMTP_USER || fromParsed.address,
      to,
      bcc
    }
  };
}

async function sendClientQuoteEmail(quote, pdfPath) {
  const fromParsed = parseFromAddress();
  const to = resolveClientTo(quote) || resolveCompanyTo(fromParsed.address);
  const code6 = (quote.token || '').slice(-6);
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl = `${baseUrl.replace(/\/$/, '')}/accept?file=${quote.quoteNumber}.json&token=${quote.token}`;
  const company = composeCompanyBlock(quote);
  const mail = {
    ...baseMail(fromParsed, to, undefined),
    subject: `Cotización ${quote.quoteNumber} – Revise, apruebe o rechace`,
    text: `Código de aceptación: ${code6}\nEnlace: ${acceptUrl}\n` ,
    html:
      `<div style="font-family:Arial,sans-serif">
         <h2 style="margin:0 0 8px">Cotización ${quote.quoteNumber}</h2>
         <p style="margin:0 0 8px">Puede <strong>aprobar</strong> o <strong>rechazar</strong> esta cotización con el siguiente enlace.</p>
         <p style="margin:0 0 8px">Código de aceptación: <strong>${code6}</strong></p>
         <p style="margin:0 0 12px"><a href="${acceptUrl}">Abrir cotización</a></p>
         ${buildQuoteSummaryHTML(quote)}
         ${company.html}
       </div>`,
    attachments: pdfPath ? [{ filename: path.basename(pdfPath), path: pdfPath }, ...company.attachments] : company.attachments
  };
  return transporter.sendMail(mail);
}

async function sendCompanyStateEmail(quote, pdfPath, state, extra = {}) {
  const fromParsed = parseFromAddress();
  const to = resolveCompanyTo(fromParsed.address);
  const company = composeCompanyBlock(quote);
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl = `${baseUrl.replace(/\/$/, '')}/accept?file=${quote.quoteNumber}.json&token=${quote.token}`;

  let subject;
  let lead;
  if (state === 'needsReview') {
    subject = `Cotización ${quote.quoteNumber} – Solicita revisión`;
    lead = `El cliente ha solicitado <strong>revisión</strong> de la cotización.`;
  } else if (state === 'approved') {
    subject = `Cotización ${quote.quoteNumber} – ACEPTADA`;
    lead = `La cotización fue <strong>ACEPTADA</strong> por ${quote.approvedBy || 'Web'} el ${quote.approvedAt || ''}.`;
  } else if (state === 'rejected') {
    subject = `Cotización ${quote.quoteNumber} – RECHAZADA`;
    lead = `La cotización fue <strong>RECHAZADA</strong> por ${quote.rejectedBy || 'Web'} el ${quote.rejectedAt || ''}.`;
    if (extra.reason) lead += ` Motivo: <em>${extra.reason}</em>`;
  } else if (state === 'updated') {
    subject = `Cotización ${quote.quoteNumber} – Actualizada`;
    lead = `La cotización fue <strong>actualizada</strong>.`;
  } else {
    subject = `Cotización ${quote.quoteNumber}`;
    lead = `Cambio de estado.`;
  }

  const mail = {
    ...baseMail(fromParsed, to, undefined),
    subject,
    text: `${lead.replace(/<[^>]*>/g,'')}\n${acceptUrl}\n`,
    html:
      `<div style="font-family:Arial,sans-serif">
         <h2 style="margin:0 0 8px">${subject}</h2>
         <p style="margin:0 0 12px">${lead}</p>
         <p style="margin:0 0 12px"><a href="${acceptUrl}">Abrir cotización</a></p>
         ${buildQuoteSummaryHTML(quote)}
         ${company.html}
       </div>`,
    attachments: pdfPath ? [{ filename: path.basename(pdfPath), path: pdfPath }, ...company.attachments] : company.attachments
  };
  return transporter.sendMail(mail);
}

module.exports = { sendClientQuoteEmail, sendCompanyStateEmail, transporter };
