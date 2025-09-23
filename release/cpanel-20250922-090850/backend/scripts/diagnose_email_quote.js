require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR, readJSON } = require('../lib/storage');
const { transporter, sendQuoteEmail } = require('../utils/email');

/**
 * Diagnostic script to validate email-sending prerequisites for a given quote file
 * Usage: node backend/scripts/diagnose_email_quote.js <quoteFilenameOrNumber>
 *  - Accepts either full filename (e.g., COT-2025-123456.json) or just the reference (e.g., COT-2025-123456)
 */
(async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node backend/scripts/diagnose_email_quote.js <COT-YYYY-NNNNNN[.json]>. Ej: COT-2025-123456');
    process.exit(1);
  }

  const filename = arg.endsWith('.json') ? arg : `${arg}.json`;
  const fullPath = path.join(OUTPUTS_DIR, filename);

  const env = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_NOTIFY_TO: process.env.SMTP_NOTIFY_TO,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };

  console.log('--- Entorno SMTP/APP ---');
  console.table(env);

  // Verify transporter connectivity
  try {
    const verify = await transporter.verify();
    console.log('Transporter.verify():', verify);
  } catch (e) {
    console.error('Fallo transporter.verify():', e && e.message);
  }

  // Quote existence and structure
  console.log('\n--- Verificando cotización ---');
  console.log('Ruta JSON:', fullPath);
  if (!fs.existsSync(fullPath)) {
    console.error('No existe el archivo de cotización.');
    process.exit(1);
  }
  const quote = readJSON(filename);
  if (!quote) {
    console.error('No se pudo leer/parsear la cotización');
    process.exit(1);
  }
  console.log('Referencia:', quote.quoteNumber);
  console.log('Cliente:', quote.client);
  console.log('Email cliente:', quote.clientEmail || '(vacío)');
  console.log('Token:', quote.token ? `${quote.token.slice(0,10)}...` : '(vacío)');

  // Check PDF path
  const pdfPath = path.join(OUTPUTS_DIR, 'pdfs', `${quote.quoteNumber}.pdf`);
  console.log('PDF esperado:', pdfPath, fs.existsSync(pdfPath) ? '(existe)' : '(NO existe)');

  // Dry-run validation of sendQuoteEmail payload
  const to = quote.clientEmail || process.env.SMTP_NOTIFY_TO || process.env.SMTP_FALLBACK_TO;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  console.log('\n--- Validación de destinatarios ---');
  console.log('FROM:', from || '(vacío)');
  console.log('TO (cliente/fallback):', to || '(vacío)');
  console.log('BCC (admin):', process.env.SMTP_NOTIFY_TO || '(vacío)');

  const problems = [];
  if (!from) problems.push('SMTP_FROM o SMTP_USER no definido');
  if (!to) problems.push('clientEmail y SMTP_NOTIFY_TO/SMTP_FALLBACK_TO vacíos');
  if (!quote.token) problems.push('Token vacío: los links de aceptación no funcionarán');
  if (!fs.existsSync(pdfPath)) problems.push('PDF no existe: genera la cotización antes o corre regenerate_pdfs');

  if (problems.length) {
    console.log('\n--- Problemas detectados ---');
    problems.forEach((p, i) => console.log(`${i+1}. ${p}`));
  } else {
    console.log('\nNo se detectaron problemas de configuración evidentes.');
  }

  // Optional: attempt a real send with a "dry-run" toggle
  const doSend = /^true|1|yes$/i.test(String(process.env.DIAGNOSE_SEND || 'false'));
  console.log(`\nIntento de envío real: ${doSend ? 'SÍ' : 'NO'} (establece DIAGNOSE_SEND=true para enviar)`);
  if (doSend) {
    try {
      if (fs.existsSync(pdfPath)) {
  const info = await sendQuoteEmail(quote, pdfPath);
  console.log('Envío real OK. messageId:', info && info.messageId);
  if (info && info.accepted) console.log('Accepted:', info.accepted);
  if (info && info.rejected && info.rejected.length) console.warn('Rejected:', info.rejected);
  if (info && info.response) console.log('Server response:', info.response);
      } else {
        console.log('Saltando envío real: no hay PDF');
      }
    } catch (e) {
      console.error('Error en envío real:', e && e.message, e && e.code);
      if (e && e.response) console.error('Response:', e.response);
    }
  }
})();
