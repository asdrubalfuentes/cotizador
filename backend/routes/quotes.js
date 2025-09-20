const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { saveJSON, readJSON, listQuotes, nextRef, OUTPUTS_DIR } = require('../lib/storage');
const { generatePDFWithPDFKit } = require('../utils/pdf');
const { sendQuoteEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

router.get('/', (req, res) => {
  const files = listQuotes();
  const data = files.map(f => {
    const j = readJSON(f.file);
    return {
      file: f.file,
      quoteNumber: j.quoteNumber,
      token: j.token,
      client: j.client,
      total: j.total,
      currency: j.currency || 'CLP',
      clientEmail: j.clientEmail,
      clientAddress: j.clientAddress,
      clientPhone: j.clientPhone,
      clientTaxId: j.clientTaxId,
      companyId: j.companyId,
      isRequiredPrepayment: j.isRequiredPrepayment,
      prepaymentValue: j.prepaymentValue,
      isApproved: j.approvedAt ? true : false,
      approvedBy: j.approvedBy,
      approvedAt: j.approvedAt,
      rejected: !!j.rejected,
      rejectedReason: j.rejectedReason,
      rejectedBy: j.rejectedBy,
      rejectedAt: j.rejectedAt,
      items: j.items
    };
  });
  res.json(data);
});

router.get('/next_ref', (req, res) => {
  res.json({ next: nextRef() });
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const ref = nextRef();
    body.quoteNumber = ref;
    body.saved_at = new Date().toISOString();

    // Add currency conversion data
    if (body.currency && body.currency !== 'CLP') {
      try {
        const axios = require('axios');
        const apiUrl = body.currency === 'UF' ? 'https://mindicador.cl/api/uf' : 'https://mindicador.cl/api/dolar';
        const rateRes = await axios.get(apiUrl);
        const rate = rateRes.data.serie[0]?.valor || 0;
        body.totalInCLP = Math.round(body.total * rate * 100) / 100;
        body.currencyRate = rate;
      } catch (e) {
        console.error('Error fetching currency rate:', e);
      }
    }

    // create token
    const token = jwt.sign({ client: body.client, quoteNumber: ref }, JWT_SECRET);
    body.token = token;
    const filename = `${ref}.json`;
    saveJSON(filename, body);
    // generate PDF
    const pdfPath = path.join(OUTPUTS_DIR, 'pdfs');
    if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });
    const pdfFile = path.join(pdfPath, `${ref}.pdf`);
    await generatePDFWithPDFKit(body, pdfFile);
    // send email (async, ignore result)
    sendQuoteEmail(body, pdfFile).catch(err => console.error('email error', err));
    res.json({ ok: true, file: filename, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/:file', (req, res) => {
  const file = req.params.file;
  const data = readJSON(file);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

// PUT /api/quotes/:file - update existing quote
router.put('/:file', async (req, res) => {
  try {
    const file = req.params.file;
    const existingData = readJSON(file);
    if (!existingData) return res.status(404).json({ error: 'not found' });

    const body = req.body;
    // Preserve original quote number and token
    body.quoteNumber = existingData.quoteNumber;
    body.token = existingData.token;
    body.saved_at = new Date().toISOString();

    // Reset approval/rejection state on edit
    body.approvedBy = null;
    body.approvedAt = null;
    body.rejected = false;
    body.rejectedReason = '';
    body.rejectedBy = null;
    body.rejectedAt = null;

    // Recompute currency conversion data (if applicable)
    try {
      if (body.currency && body.currency !== 'CLP') {
        const axios = require('axios');
        const apiUrl = body.currency === 'UF' ? 'https://mindicador.cl/api/uf' : 'https://mindicador.cl/api/dolar';
        const rateRes = await axios.get(apiUrl);
        const rate = rateRes.data.serie[0]?.valor || 0;
        body.totalInCLP = Math.round(Number(body.total || 0) * rate * 100) / 100;
        body.currencyRate = rate;
      } else {
        body.totalInCLP = undefined;
        body.currencyRate = undefined;
      }
    } catch (e) {
      console.error('Error fetching currency rate on update:', e);
    }

    saveJSON(file, body);

    // Regenerate PDF
    const pdfPath = path.join(OUTPUTS_DIR, 'pdfs');
    if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });
    const pdfFile = path.join(pdfPath, `${body.quoteNumber}.pdf`);
    await generatePDFWithPDFKit(body, pdfFile);

    // Send updated quote email asynchronously
    sendQuoteEmail(body, pdfFile).catch(err => console.error('email after update error', err));

    res.json({ ok: true, file: file, token: body.token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// DELETE /api/quotes/:file - delete quote
router.delete('/:file', (req, res) => {
  try {
    const file = req.params.file;
    const data = readJSON(file);
    if (!data) return res.status(404).json({ error: 'not found' });

    // Delete JSON file
    const jsonPath = path.join(OUTPUTS_DIR, file);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

    // Delete PDF file
    const pdfFile = file.replace('.json', '.pdf');
    const pdfPath = path.join(OUTPUTS_DIR, 'pdfs', pdfFile);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    // Delete QR file
    const qrFile = data.quoteNumber + '_qr.png';
    const qrPath = path.join(OUTPUTS_DIR, qrFile);
    if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/:file/approve', async (req, res) => {
  const file = req.params.file;
  const data = readJSON(file);
  if (!data) return res.status(404).json({ error: 'not found' });
  const { code6, approverName, prepayment, reject, reason } = req.body;
  const token = data.token || '';
  const code = token.slice(-6);
  if (code !== code6) return res.status(400).json({ error: 'invalid code' });

  if (reject) {
    data.rejected = true;
    data.rejectedReason = reason || '';
    data.rejectedBy = approverName || 'Web';
    data.rejectedAt = new Date().toISOString();
    saveJSON(file, data);
    try {
      // Regenerate PDF to include RECHAZADA watermark
      const pdfPath = path.join(OUTPUTS_DIR, 'pdfs');
      if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });
      const pdfFile = path.join(pdfPath, `${data.quoteNumber}.pdf`);
      await generatePDFWithPDFKit(data, pdfFile);
      // Notify admin and inform client of rejection
      const { sendRejectionEmail, sendQuoteEmail } = require('../utils/email');
      if (sendRejectionEmail) {
        await sendRejectionEmail(data);
      }
      // Inform the client (uses BCC to admin automatically if SMTP_NOTIFY_TO is set)
      if (data.clientEmail) {
        await sendQuoteEmail(data, pdfFile);
      }
    } catch (err) {
      console.error('email after reject error', err);
    }
    return res.json({ ok: true, rejected: true });
  }

  // prepayment check
  if (data.isRequiredPrepayment) {
    if (!prepayment || Number(prepayment) !== Number(data.prepaymentValue)) {
      return res.status(400).json({ error: 'invalid prepayment' });
    }
  }

  data.approvedBy = approverName || 'Web';
  data.approvedAt = new Date().toISOString();
  // save and regenerate PDF with watermark
  saveJSON(file, data);
  try {
    const pdfPath = path.join(OUTPUTS_DIR, 'pdfs');
    if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });
    const pdfFile = path.join(pdfPath, `${data.quoteNumber}.pdf`);
    await generatePDFWithPDFKit(data, pdfFile);
    // optionally send confirmation email
    sendQuoteEmail(data, pdfFile).catch(err => console.error('email after approve error', err));
    return res.json({ ok: true, regenerated: true });
  } catch (err) {
    console.error('Error regenerating PDF on approve', err);
    return res.status(500).json({ error: 'approved_but_regen_failed' });
  }
});

module.exports = router;
