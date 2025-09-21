const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { OUTPUTS_DIR } = require('../lib/storage');
const axios = require('axios');
// removed unused inspector import

var ufRate = 0;
var usdRate = 0;

async function loadCurrencyRates() {
  try {
    const [ufRes, usdRes] = await Promise.all([
      axios.get('https://mindicador.cl/api/uf'),
      axios.get('https://mindicador.cl/api/dolar')
    ]);
    ufRate = ufRes.data.serie[0]?.valor || 0;
    usdRate = usdRes.data.serie[0]?.valor || 0;
  } catch (e) {
    console.error('Error loading currency rates:', e);
  }
}

async function generatePDFWithPDFKit(data, outPath) {
  return new Promise((resolve, reject) => {
    (async () => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(outPath);
      await loadCurrencyRates();
      doc.pipe(stream);

      // Get company data
      const empresas = JSON.parse(fs.readFileSync(path.join(OUTPUTS_DIR, 'empresas.json'), 'utf8')) || [];
      const company = empresas.find(emp => emp.id === data.companyId) || {};

      // Header: Company logo and info
      const headerY = 40;
      const logoSize = 60;

      if (company.logo) {
        const logoPath = path.join(OUTPUTS_DIR, 'logos', company.logo);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, headerY, { width: logoSize, height: logoSize });
        }
      }

      // Company info (next to logo)
      const companyInfoX = 120;
      doc.fontSize(16).text(company.name || 'Empresa', companyInfoX, headerY);
      doc.fontSize(10);
      let companyY = headerY + 20;
      if (company.email) {
        doc.text(`${company.email}`, companyInfoX, companyY);
        companyY += 12;
      }
      if (company.address) {
        doc.text(`${company.address}`, companyInfoX, companyY);
        companyY += 12;
      }
      if (company.phone) {
        doc.text(`${company.phone}`, companyInfoX, companyY);
        companyY += 12;
      }
      if (company.taxId) {
        doc.text(`${company.taxId}`, companyInfoX, companyY);
        companyY += 12;
      }

      // Quote info (below company info)
      const quoteInfoY = Math.max(headerY + logoSize + 20, companyY + 10);
      doc.fontSize(14).text(`COTIZACIÓN ${data.quoteNumber}`, 40, quoteInfoY);
      doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, 40, quoteInfoY + 20);

      // Client info on the right side
      const clientStartX = 350;
      const clientStartY = headerY;
      doc.fontSize(12).text('Datos del Cliente', clientStartX, clientStartY, { underline: true });
      doc.fontSize(10);
      let clientY = clientStartY + 20;
      doc.text(`${data.client || ''}`, clientStartX, clientY);
      clientY += 12;
      if (data.clientEmail) {
        doc.text(`${data.clientEmail}`, clientStartX, clientY);
        clientY += 12;
      }
      if (data.clientAddress) {
        doc.text(`${data.clientAddress}`, clientStartX, clientY);
        clientY += 12;
      }
      if (data.clientPhone) {
        doc.text(`${data.clientPhone}`, clientStartX, clientY);
        clientY += 12;
      }
      if (data.clientTaxId) {
        doc.text(`${data.clientTaxId}`, clientStartX, clientY);
        clientY += 12;
      }

      // Items table - positioned after header sections
      const tableY = Math.max(quoteInfoY + 50, clientY + 20);
      doc.fontSize(12).text('DETALLE', 40, tableY, { underline: true });

      // Table headers
      const tableHeaderY = tableY + 20;
      doc.fontSize(9);
      doc.text('Descripción', 40, tableHeaderY);
      doc.text('Cant.', 300, tableHeaderY);
      doc.text('Desc.%', 340, tableHeaderY);
      doc.text('V.Unit.', 380, tableHeaderY);
      doc.text('Subtotal', 450, tableHeaderY);

      // Draw header line
      doc.moveTo(40, tableHeaderY + 15).lineTo(520, tableHeaderY + 15).stroke();

      // Items
      let currentY = tableHeaderY + 25;
  data.items && data.items.forEach((item, _i) => {
        const subtotal = (item.qty || 0) * (item.price || 0) * (1 - ((item.discount || 0) / 100));

        // Calculate description height (wrap text)
        const descLines = doc.heightOfString(item.desc || '', { width: 250 });
        const itemHeight = Math.max(descLines, 20);

        // Item content (no rectangles)
        doc.text(item.desc || '', 40, currentY, { width: 250, align: 'justify' });
        doc.text(String(item.qty || 0), 300, currentY);
        doc.text(`${item.discount || 0}%`, 340, currentY);
        doc.text(String(item.price || 0), 380, currentY);
        doc.text(String(Math.round(subtotal * 100) / 100), 450, currentY);

        currentY += itemHeight + 10;
      });

      // Totals with proper alignment
      const totalsY = currentY + 20;
      const labelWidth = 80;
      const valueWidth = 100;
      const totalsX = 310;

      doc.fontSize(10);
      // Neto
      doc.text('Neto:', totalsX, totalsY);
      //doc.text(`${data.net || 0} ${data.currency || 'CLP'}`, totalsX + labelWidth, totalsY, { align: 'right', width: valueWidth });
      doc.text(`${(data.net || 0).toFixed(2)} ${data.currency || 'CLP'}`, totalsX + labelWidth, totalsY, { align: 'right', width: valueWidth });

      // IVA
      doc.text('IVA (19%):', totalsX, totalsY + 15);
      doc.text(`${data.tax || 0} ${data.currency || 'CLP'}`, totalsX + labelWidth, totalsY + 15, { align: 'right', width: valueWidth });

      // Total
      doc.fontSize(12).text('TOTAL:', totalsX, totalsY + 35);
      doc.fontSize(12).text(`${data.total || 0} ${data.currency || 'CLP'}`, totalsX + labelWidth, totalsY + 35, { align: 'right', width: valueWidth, underline: true });

      // Currency conversion if not CLP
      if (data.currency && data.currency !== 'CLP') {
        if(data.currency === 'UF') {
          doc.fontSize(9).text(`(Conversión a CLP: ${data.totalInCLP || '$' + (data.total * ufRate).toFixed(0)})`, totalsX, totalsY + 55, { align: 'right', width: valueWidth + 100 });
        } else if(data.currency === 'USD') {
          doc.fontSize(9).text(`(Conversión a CLP: ${data.totalInCLP || '$' + (data.total * usdRate).toFixed(0)})`, totalsX, totalsY + 55, { align: 'right', width: valueWidth + 100 });
        }
      }

      // Terms and conditions section (below totals)
      const termsSectionY = totalsY + 80;
      doc.fontSize(10);

      // Payment details
      if (company.paymentDetails) {
        doc.text('DETALLES DE PAGO:', 40, termsSectionY, { underline: true });
        const paymentHeight = doc.heightOfString(company.paymentDetails, { width: 300 });
        doc.text(company.paymentDetails, 40, termsSectionY + 15, { width: 300, align: 'justify' });

        // Terms and conditions (below payment details)
        let termsText = company.terms || '';

        // Add prepayment requirement if needed
        if (data.isRequiredPrepayment && data.prepaymentValue) {
          const prepaymentText = `Se requiere pagar un anticipo de: ${data.prepaymentValue} ${data.currency || 'CLP'}`;
          if (data.currency !== 'CLP') {
            const clpValue = data.totalInCLP || data.total;
            termsText += `\n\n${prepaymentText} (${clpValue} CLP)`;
          } else {
            termsText += `\n\n${prepaymentText}`;
          }
        }

        if (termsText) {
          const termsStartY = termsSectionY + 15 + paymentHeight + 20;
          doc.text('TÉRMINOS Y CONDICIONES:', 40, termsStartY, { underline: true });
          doc.text(termsText, 40, termsStartY + 15, { width: 300, align: 'justify' });
        }
      } else {
        // Only terms and conditions (no payment details)
        let termsText = company.terms || '';

        // Add prepayment requirement if needed
        if (data.isRequiredPrepayment && data.prepaymentValue) {
          const prepaymentText = `Se requiere pagar un anticipo de: ${data.prepaymentValue} ${data.currency || 'CLP'}`;
          if (data.currency !== 'CLP') {
            const clpValue = data.totalInCLP || data.total;
            termsText += `\n\n${prepaymentText} (${clpValue} CLP)`;
          } else {
            termsText += `\n\n${prepaymentText}`;
          }
        }

        if (termsText) {
          doc.text('TÉRMINOS Y CONDICIONES:', 40, termsSectionY, { underline: true });
          doc.text(termsText, 40, termsSectionY + 15, { width: 300, align: 'justify' });
        }
      }

      // Watermarks
      // Priority: RECHAZADA > ACEPTADA > REVISAR > APROBAR
      let watermarkText = null;
      let color = 'red';
      if (data.rejected) {
        watermarkText = 'RECHAZADA';
        color = 'red';
      } else if (data.approvedAt) {
        watermarkText = 'ACEPTADA';
        color = 'green';
      } else if (data.needsReview) {
        watermarkText = 'REVISAR';
        color = 'blue';
      } else {
        // Pending or newly created/edited
        watermarkText = 'APROBAR';
        color = 'orange';
      }
      if (watermarkText) {
        const y = 400;
        doc.fillColor(color).fontSize(60).opacity(0.2).rotate(-25, { origin: [300, y] });
        doc.text(watermarkText, 80, y);
        doc.rotate(25, { origin: [300, y] });
        doc.opacity(1).fillColor('black');
      }

      // QR generation - positioned at bottom center
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const qrData = JSON.stringify({
        client: data.client,
        total: data.total,
        quote: data.quoteNumber,
        currency: data.currency || 'CLP',
        url: baseUrl.replace(/\/$/, '') + '/accept?file=' + data.quoteNumber + '.json&token=' + data.token,
      });
      const qrPath = path.join(OUTPUTS_DIR, `${data.quoteNumber}_qr.png`);
      await QRCode.toFile(qrPath, qrData);
      if (fs.existsSync(qrPath)) {
        // Center QR code horizontally and position at bottom
        const qrSize = 80;
        const qrX = (doc.page.width - qrSize) / 2;
        const qrY = doc.page.height - 120;
        doc.image(qrPath, qrX, qrY, { width: qrSize, height: qrSize });
      }

      doc.end();
      stream.on('finish', () => resolve(outPath));
    })().catch(reject);
  });
}

module.exports = { generatePDFWithPDFKit };
