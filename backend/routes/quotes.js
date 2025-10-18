const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { saveJSON, readJSON, listQuotes, nextRef, OUTPUTS_DIR, PDFS_DIR } = require('../lib/storage');
const { requireRole } = require('../middleware/auth');
const { generatePDFWithPDFKit } = require('../utils/pdf');
const { sendClientQuoteEmail, sendCompanyStateEmail } = require('../utils/email');
const { broadcast } = require('../lib/events');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const RATES_TIMEOUT_MS = Number(process.env.RATES_TIMEOUT_MS || 3500);
const QUOTE_SKIP_RATES = String(process.env.QUOTE_SKIP_RATES || '').trim() === '1';

// Generación de PDF y envío de correo en background para no bloquear la respuesta HTTP
function generatePdfAndNotifyAsync(data) {
  try {
    setImmediate(async () => {
      try {
        const pdfPath = path.join(OUTPUTS_DIR, 'pdfs');
        if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });
        const pdfFile = path.join(pdfPath, `${data.quoteNumber}.pdf`);
        await generatePDFWithPDFKit(data, pdfFile);
        // Clear processing flag in stored JSON
        try {
          const jf = `${data.quoteNumber}.json`;
          const obj = readJSON(jf);
          if (obj) { obj.processingPDF = false; saveJSON(jf, obj); }
        } catch (e) { console.warn('failed to clear processingPDF', e?.message || e) }
        try { broadcast('quote.pdfReady', { quoteNumber: data.quoteNumber, file: `${data.quoteNumber}.pdf` }); } catch (e) { console.warn('sse broadcast failed (pdfReady)', e?.message || e); }
        try { await sendClientQuoteEmail(data, pdfFile); } catch (e) { console.error('email error (async)', e); }
      } catch (e) {
        console.error('async pdf/email error', e?.message || e);
      }
    });
  } catch (e) {
    console.error('schedule async pdf failed', e?.message || e);
  }
}

// Genera PDF y notifica a la empresa según estado (approved/rejected/needsReview) en background
function generatePdfAndNotifyCompanyAsync(data, state, extra) {
  try {
    setImmediate(async () => {
      try {
        const pdfPath = path.join(OUTPUTS_DIR, 'pdfs');
        if (!fs.existsSync(pdfPath)) fs.mkdirSync(pdfPath, { recursive: true });
        const pdfFile = path.join(pdfPath, `${data.quoteNumber}.pdf`);
        await generatePDFWithPDFKit(data, pdfFile);
        // Clear processing flag in stored JSON
        try {
          const jf = `${data.quoteNumber}.json`;
          const obj = readJSON(jf);
          if (obj) { obj.processingPDF = false; saveJSON(jf, obj); }
        } catch (e) { console.warn('failed to clear processingPDF', e?.message || e) }
        try { broadcast('quote.pdfReady', { quoteNumber: data.quoteNumber, file: `${data.quoteNumber}.pdf` }); } catch (e) { console.warn('sse broadcast failed (pdfReady)', e?.message || e); }
        try { await sendCompanyStateEmail(data, pdfFile, state, extra); } catch (e) { console.error('email company error (async)', e); }
      } catch (e) {
        console.error('async pdf/email company error', e?.message || e);
      }
    });
  } catch (e) {
    console.error('schedule async company pdf failed', e?.message || e);
  }
}

function addBusinessDays(isoStart, bizDays) {
  try {
    const d = new Date(isoStart || Date.now());
    let days = Number(bizDays || 0);
    while (days > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay(); // 0 Sun, 6 Sat
      if (day !== 0 && day !== 6) days--;
    }
    return d.toISOString();
  } catch { return undefined }
}

router.get('/', (req, res) => {
  const files = listQuotes();
  const data = files.map(f => {
    const j = readJSON(f.file);
    return {
      file: f.file,
      quoteNumber: j.quoteNumber,
      created_at: j.created_at || j.createdAt,
      saved_at: j.saved_at || j.savedAt,
      processingPDF: !!j.processingPDF,
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
      needsReview: !!j.needsReview,
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

// Quotes del cliente autenticado (por email y asociaciones)
router.get('/mine', requireRole(['cliente','admin']), (req, res) => {
  try {
    const email = (req.user && req.user.email) ? String(req.user.email).toLowerCase() : '';
    if (!email) return res.status(401).json({ error: 'unauthorized' });
    const files = listQuotes();
    // reglas de vinculación: por email directo + asociaciones configuradas
    let links = {};
    try { links = require('../lib/client_links').getLinks() || {}; } catch { links = {}; }
    const lk = links[email] || { clientEmails: [], clientNames: [], taxIds: [] };
    const otherEmails = new Set((lk.clientEmails || []).map(e => String(e||'').toLowerCase()));
    const names = new Set((lk.clientNames || []).map(n => String(n||'').toLowerCase()));
    const taxIds = new Set((lk.taxIds || []).map(t => String(t||'').toUpperCase()));

    const match = (j) => {
      const jEmail = String(j?.clientEmail || '').toLowerCase();
      if (jEmail === email) return true;
      if (otherEmails.has(jEmail)) return true;
      const jName = String(j?.client || '').toLowerCase();
      if (jName && names.has(jName)) return true;
      const jTax = String(j?.clientTaxId || '').toUpperCase();
      if (jTax && taxIds.has(jTax)) return true;
      return false;
    };

    const data = files.map(f => ({ f, j: readJSON(f.file) })).filter(({ j }) => match(j))
      .map(({ f, j }) => ({
        file: f.file,
        quoteNumber: j.quoteNumber,
        token: j.token,
        client: j.client,
        total: j.total,
        currency: j.currency || 'CLP',
        saved_at: j.saved_at || j.savedAt,
        approvedAt: j.approvedAt,
        rejected: !!j.rejected,
        needsReview: !!j.needsReview,
        expires_at: j.expires_at,
        validDays: j.validDays
      }));
    res.json({ ok: true, quotes: data });
  } catch (e) {
    console.error('mine error', e);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/next_ref', (req, res) => {
  res.json({ next: nextRef() });
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const ref = nextRef();
    body.quoteNumber = ref;
    body.created_at = new Date().toISOString();
    body.saved_at = new Date().toISOString();
    if (body.validDays) {
      body.expires_at = addBusinessDays(body.saved_at, body.validDays);
    }

    // Add currency conversion data
    if (!QUOTE_SKIP_RATES && body.currency && body.currency !== 'CLP') {
      try {
        const axios = require('axios');
        const apiUrl = body.currency === 'UF' ? 'https://mindicador.cl/api/uf' : 'https://mindicador.cl/api/dolar';
        const rateRes = await axios.get(apiUrl, { timeout: RATES_TIMEOUT_MS });
        const rate = rateRes.data.serie[0]?.valor || 0;
        body.totalInCLP = Math.round(body.total * rate * 100) / 100;
        body.currencyRate = rate;
      } catch (e) {
        console.error('Error fetching currency rate:', e?.message || e);
      }
    }

    // create token
    const token = jwt.sign({ client: body.client, quoteNumber: ref }, JWT_SECRET);
    body.token = token;
  const filename = `${ref}.json`;
  body.processingPDF = true;
  saveJSON(filename, body);
    // generate PDF
    // Generar PDF y enviar correo en background para evitar bloqueos
    generatePdfAndNotifyAsync(body);
    broadcast('quote.created', { quoteNumber: body.quoteNumber });
    res.json({ ok: true, file: filename, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Cliente solicita reactivación de una cotización vencida (o cerrar rechazo)
router.post('/:file/reactivate', requireRole(['cliente']), (req, res) => {
  try {
    const file = req.params.file;
    const data = readJSON(file);
    if (!data) return res.status(404).json({ error: 'not found' });
    const email = (req.user && req.user.email) ? String(req.user.email).toLowerCase() : '';
    if ((data.clientEmail || '').toLowerCase() !== email) return res.status(403).json({ error: 'forbidden' });
    data.reactivationRequestedAt = new Date().toISOString();
    data.needsReview = true;
  data.processingPDF = true;
  saveJSON(file, data);
  try { broadcast('quote.reactivationRequested', { quoteNumber: data.quoteNumber }); } catch (_e) { /* ignore */ }
    res.json({ ok: true });
  } catch (e) {
    console.error('reactivate error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Cliente repite servicio: crea nueva cotización clonando items e info del cliente
router.post('/:file/repeat', requireRole(['cliente']), async (req, res) => {
  try {
    const file = req.params.file;
    const base = readJSON(file);
    if (!base) return res.status(404).json({ error: 'not found' });
    const email = (req.user && req.user.email) ? String(req.user.email).toLowerCase() : '';
    if ((base.clientEmail || '').toLowerCase() !== email) return res.status(403).json({ error: 'forbidden' });

    const ref = nextRef();
    const body = {
      client: base.client,
      clientEmail: base.clientEmail,
      clientAddress: base.clientAddress,
      clientPhone: base.clientPhone,
      clientTaxId: base.clientTaxId,
      items: Array.isArray(base.items) ? base.items : [],
      currency: base.currency || 'CLP',
      isRequiredPrepayment: base.isRequiredPrepayment || false,
      prepaymentValue: base.prepaymentValue || 0,
      total: base.total,
      title: `Repetición de ${base.quoteNumber}`
    };

    body.quoteNumber = ref;
    body.created_at = new Date().toISOString();
    body.saved_at = new Date().toISOString();
    const token = jwt.sign({ client: body.client, quoteNumber: ref }, JWT_SECRET);
    body.token = token;
    const filename = `${ref}.json`;
  body.processingPDF = true;
  saveJSON(filename, body);

  // Generar PDF y enviar correo en background
  generatePdfAndNotifyAsync(body);
    broadcast('quote.created', { quoteNumber: body.quoteNumber });
    res.json({ ok: true, file: filename, token });
  } catch (e) {
    console.error('repeat error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Estadísticas para cotizador/admin
router.get('/stats', requireRole(['cotizador','admin']), (req, res) => {
  try {
    const files = listQuotes();
    const now = Date.now();
    const stats = { total: files.length, byStatus: { accepted:0, rejected:0, needsReview:0, inProcess:0, expired:0 },
      totalsAcceptedNotExpired: 0, byClient: {} };
    for (const f of files) {
      const j = readJSON(f.file);
      if (!j) continue;
      const expired = j.validDays && (new Date(j.saved_at || j.created_at || Date.now()).getTime() + Number(j.validDays)*24*3600*1000) < now;
      let s = 'inProcess';
      if (j.rejected) s = 'rejected'; else if (j.needsReview) s = 'needsReview'; else if (j.approvedAt) s = 'accepted';
      if (expired) stats.byStatus.expired++; else stats.byStatus[s]++;
      if (s==='accepted' && !expired) stats.totalsAcceptedNotExpired += Number(j.total||0);
      const key = j.client || 'Sin cliente';
      if (!stats.byClient[key]) stats.byClient[key] = { count:0, last:null };
      stats.byClient[key].count++;
      const saved = j.saved_at || j.created_at;
      if (!stats.byClient[key].last || String(saved) > stats.byClient[key].last) stats.byClient[key].last = saved;
    }
    res.json({ ok:true, stats });
  } catch (e) {
    console.error('stats error', e);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/:file', (req, res) => {
  const file = req.params.file;
  const data = readJSON(file);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

// GET /api/quotes/:file/pdf - descarga el PDF con nombre decorado con el título (sin afectar almacenamiento)
router.get('/:file/pdf', (req, res) => {
  try {
    const file = req.params.file;
    const data = readJSON(file);
    if (!data) return res.status(404).json({ error: 'not found' });
    const pdfFile = path.join(PDFS_DIR, `${data.quoteNumber}.pdf`);
    if (!fs.existsSync(pdfFile)) return res.status(404).json({ error: 'pdf_not_found' });
    // Soporte para visualización inline en iframe si se pasa ?inline=1
    if (String(req.query.inline || '') === '1') {
      res.setHeader('Content-Type', 'application/pdf');
      // Content-Disposition inline permite previsualizar en navegador
      const rawTitleInline = String(data.title || '').trim();
      const sanitizedInline = rawTitleInline
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
        .replace(/[\s]+/g, ' ')
        .trim()
        .slice(0, 80)
        .replace(/[\s]/g, '_');
      const decoratedInline = `${data.quoteNumber}${sanitizedInline ? ' - ' + sanitizedInline : ''}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${decoratedInline}"`);
      return res.sendFile(pdfFile);
    }
    const rawTitle = String(data.title || '').trim();
    const sanitized = rawTitle
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
      .replace(/[\s]+/g, ' ')
      .trim()
      .slice(0, 80)
      .replace(/[\s]/g, '_');
    const decorated = `${data.quoteNumber}${sanitized ? ' - ' + sanitized : ''}.pdf`;
    return res.download(pdfFile, decorated);
  } catch (e) {
    console.error('download pdf error', e);
    return res.status(500).json({ error: 'server error' });
  }
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
    // Si estaba rechazada, rotar token en edición
    if (existingData.rejected) {
      body.token = jwt.sign({ client: body.client || existingData.client, quoteNumber: existingData.quoteNumber }, JWT_SECRET);
    } else {
      body.token = existingData.token;
    }
  // Preserve original creation time if present
  body.created_at = existingData.created_at || existingData.createdAt || existingData.saved_at || existingData.savedAt || new Date().toISOString();
    body.saved_at = new Date().toISOString();
    if (body.validDays) {
      body.expires_at = addBusinessDays(body.saved_at, body.validDays);
    } else {
      body.expires_at = undefined;
    }

    // Reset approval/rejection state on edit
    body.approvedBy = null;
    body.approvedAt = null;
    body.rejected = false;
    body.rejectedReason = '';
    body.rejectedBy = null;
    body.rejectedAt = null;
    body.needsReview = false;

    // Recompute currency conversion data (if applicable)
    try {
      if (!QUOTE_SKIP_RATES && body.currency && body.currency !== 'CLP') {
        const axios = require('axios');
        const apiUrl = body.currency === 'UF' ? 'https://mindicador.cl/api/uf' : 'https://mindicador.cl/api/dolar';
        const rateRes = await axios.get(apiUrl, { timeout: RATES_TIMEOUT_MS });
        const rate = rateRes.data.serie[0]?.valor || 0;
        body.totalInCLP = Math.round(Number(body.total || 0) * rate * 100) / 100;
        body.currencyRate = rate;
      } else {
        body.totalInCLP = undefined;
        body.currencyRate = undefined;
      }
    } catch (e) {
      console.error('Error fetching currency rate on update:', e?.message || e);
    }

  body.processingPDF = true;
  saveJSON(file, body);

    // Regenerate PDF
    // Generar PDF y enviar correo en background
    generatePdfAndNotifyAsync(body);
    broadcast('quote.updated', { quoteNumber: body.quoteNumber });

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
    broadcast('quote.deleted', { quoteNumber: data.quoteNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/:file/approve', async (req, res) => {
  const file = req.params.file;
  const data = readJSON(file);
  if (!data) return res.status(404).json({ error: 'not found' });
  const { code6, approverName, prepayment, prepaymentRef, reject, reason } = req.body;
  const token = data.token || '';
  const code = token.slice(-6);
  // Expiration check
  if (data.validDays) {
    const now = new Date();
    const expiry = data.expires_at ? new Date(data.expires_at) : addBusinessDays(data.saved_at || data.created_at, data.validDays);
    if (expiry && now > new Date(expiry)) {
      return res.status(400).json({ error: 'expired' });
    }
  }
  if (code !== code6) return res.status(400).json({ error: 'invalid code' });

  if (reject) {
    data.rejected = true;
    data.rejectedReason = reason || '';
    data.rejectedBy = approverName || 'Web';
    data.rejectedAt = new Date().toISOString();
    data.needsReview = false;
    // Limpiar posibles datos de prepago si los hubiera
    delete data.prepaymentRef;
  data.processingPDF = true;
  saveJSON(file, data);
    // Generar PDF y notificar a la empresa en background (rechazo)
    generatePdfAndNotifyCompanyAsync(data, 'rejected', { reason: data.rejectedReason });
  try { broadcast('quote.rejected', { quoteNumber: data.quoteNumber }); } catch (e) { console.warn('sse broadcast failed (rejected)', e?.message || e); }
    return res.json({ ok: true, rejected: true });
  }

  // prepayment check
  if (data.isRequiredPrepayment) {
    if (!prepayment || Number(prepayment) !== Number(data.prepaymentValue)) {
      return res.status(400).json({ error: 'invalid prepayment' });
    }
    if (!prepaymentRef || String(prepaymentRef).trim() === '') {
      return res.status(400).json({ error: 'missing prepayment_ref' });
    }
    data.prepaymentRef = String(prepaymentRef).trim();
  }

  // If the quote was previously rejected, mark as needsReview instead of approving directly
  if (data.rejected) {
    data.rejected = false;
    data.rejectedReason = '';
    data.rejectedBy = null;
    data.rejectedAt = null;
    data.needsReview = true;
    // Do not set approvedAt; save and regenerate PDF without watermark
    saveJSON(file, data);
    // Generar PDF y notificar a la empresa en background (necesita revisión)
    generatePdfAndNotifyCompanyAsync(data, 'needsReview');
    try { broadcast('quote.needsReview', { quoteNumber: data.quoteNumber }); } catch (e) { console.warn('sse broadcast failed (needsReview)', e?.message || e); }
    return res.json({ ok: true, needsReview: true });
  }

  data.approvedBy = approverName || 'Web';
  data.approvedAt = new Date().toISOString();
  // Guardar y generar PDF + notificar a la empresa en background (aprobada)
  data.processingPDF = true;
  saveJSON(file, data);
  generatePdfAndNotifyCompanyAsync(data, 'approved');
  try { broadcast('quote.approved', { quoteNumber: data.quoteNumber }); } catch (e) { console.warn('sse broadcast failed (approved)', e?.message || e); }
  return res.json({ ok: true, regenerated: true });
});

module.exports = router;
