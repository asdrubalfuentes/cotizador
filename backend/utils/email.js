const nodemailer = require('nodemailer');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

async function sendQuoteEmail(quote, pdfPath) {
  const to = quote.clientEmail || quote.clientContact || 'cliente@example.com';
  const code6 = (quote.token || '').slice(-6);
  const mail = {
    from: process.env.SMTP_USER || 'dev@example.com',
    to,
    subject: `Cotización ${quote.quoteNumber}`,
    text: `Adjunto PDF y código de aceptación: ${code6}`,
    attachments: [
      { filename: path.basename(pdfPath), path: pdfPath }
    ]
  };
  console.log(mail);
  return transporter.sendMail(mail);
}

module.exports = { sendQuoteEmail };
