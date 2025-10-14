const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { OUTPUTS_DIR } = require('../lib/storage');
const axios = require('axios');
const { formatNumberDot, formatAmount } = require('./number');
// removed unused inspector import

var ufRate = 0;
var usdRate = 0;

async function loadCurrencyRates() {
  try {
    const [ufRes, usdRes] = await Promise.all([
      axios.get('https://mindicador.cl/api/uf'),
      axios.get('https://mindicador.cl/api/dolar')
    ]);
    ufRate = Number(ufRes?.data?.serie?.[0]?.valor ?? 0) || 0;
    usdRate = Number(usdRes?.data?.serie?.[0]?.valor ?? 0) || 0;
  } catch (e) {
    console.error('Error loading currency rates:', e);
  }
}

async function generatePDFWithPDFKit(data, outPath) {
  return new Promise((resolve, reject) => {
    (async () => {
      const margin = 40;
      const doc = new PDFDocument({ size: 'A4', margin });
      const stream = fs.createWriteStream(outPath);
      // Manejo robusto de errores de I/O (ej. archivo bloqueado en Windows)
      stream.on('error', (err) => {
        try { doc.removeAllListeners(); } catch (_) { /* ignore */ }
        try { doc.destroy(); } catch (_) { /* ignore */ }
        reject(err);
      });
      doc.on('error', (err) => {
        try { stream.destroy(err); } catch (_) { /* ignore */ }
        reject(err);
      });
      await loadCurrencyRates();
  doc.pipe(stream);

      // Base styles
      const colorPrimary = '#333333';
      const colorMuted = '#666666';
      const colorRule = '#DDDDDD';
      const colorTableHeader = '#F2F2F2';
      const colorZebra = '#FAFAFA';
      const colorTotalsBg = '#F7F7F7';
      const fontRegular = 'Helvetica';
      const fontBold = 'Helvetica-Bold';
      doc.font(fontRegular).fillColor(colorPrimary);

  // ==============================================================
  // Watermark helper (drawn as background at the start of each page)
  // Configuración: texto depende del estado; tamaño ajustado para caber.
  // Forzar una sola línea (lineBreak: false) para evitar desborde a nueva línea.
  // ==============================================================
      function drawWatermarkBackground() {
        // Decide watermark text and color based on state
        let watermarkText = null;
        let wmColor = 'orange';
  if (data.rejected) { watermarkText = 'RECHAZADA'; wmColor = 'red'; }
  else if (data.approvedAt) { watermarkText = 'ACEPTADA'; wmColor = 'green'; }
  else if (data.needsReview) { watermarkText = 'REVISAR'; wmColor = 'blue'; }
  else { watermarkText = 'APROBAR'; wmColor = 'orange'; }
        if (!watermarkText) return;

        // Compute rotated sizing (45°) to fit width and <=60% height
        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const targetW = pageW * 0.95;
        const targetH = pageH * 0.6;
        const baseSize = 100;
        doc.font(fontBold).fontSize(baseSize);
        const baseWidth = doc.widthOfString(watermarkText);
        const k = baseWidth / baseSize || 1; // width per unit font size
        const theta = Math.PI / 4; // 45°
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        // Rotated bounding: W = (k*s)*cos + s*sin, H = (k*s)*sin + s*cos
        const denomW = (k * cos + sin);
        const denomH = (k * sin + cos);
        let sMaxW = denomW > 0 ? (targetW / denomW) : baseSize;
        let sMaxH = denomH > 0 ? (targetH / denomH) : baseSize;
        let finalSize = Math.max(36, Math.min(sMaxW, sMaxH));

        // Draw rotated, centered
        doc.save();
        doc.fontSize(finalSize);
        const textW = k * finalSize;
        const textH = finalSize;
        const centerX = pageW / 2;
        const centerY = pageH / 2;
        doc.opacity(0.08).fillColor(wmColor);
        doc.rotate(45, { origin: [centerX, centerY] });
        // Place text centered at the rotated origin (single line)
        doc.text(watermarkText, centerX - textW / 2, centerY - textH / 2, { lineBreak: false });
        doc.restore();
        // Restore base drawing styles
        doc.opacity(1).fillColor(colorPrimary).font(fontRegular).fontSize(9);
      }

  // ==============================================================
  // Page counter for footer (avoid relying on doc.page.number)
  // ==============================================================
  let pageNum = 1;

  // Draw watermark for the first page now (as background)
      drawWatermarkBackground();

      // Get company data
      const empresas = JSON.parse(fs.readFileSync(path.join(OUTPUTS_DIR, 'empresas.json'), 'utf8')) || [];
      const company = empresas.find(emp => emp.id === data.companyId) || {};

      // Helpers de medida y layout base
      const cm = (n) => n * 28.3465;
      const contentX = margin;
      const contentW = doc.page.width - margin * 2;
      const gap = cm(1.5); // 1.5 cm entre columnas
      const colW = Math.floor((contentW - gap) / 2);
      const leftX = contentX;
      const rightX = contentX + colW + gap;

  // ==============================================================
  // Membrete: Proveedor (izq) y Cliente (der)
  // Configurar logo, datos de empresa y datos de cliente.
  // ==============================================================
      const headerY = margin;
      const logoSize = 60;
      // Proveedor
      let yL = headerY;
      if (company.logo) {
        const logoPath = path.join(OUTPUTS_DIR, 'logos', company.logo);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, leftX, yL, { width: logoSize, height: logoSize });
        }
      }
      const leftTextX = leftX + (company.logo ? (logoSize + 10) : 0);
      doc.font(fontBold).fontSize(16).fillColor(colorPrimary).text(company.name || 'Empresa', leftTextX, yL, { width: colW - (leftTextX - leftX) });
      doc.font(fontRegular).fontSize(10).fillColor(colorMuted);
      let yTmp = yL + 20;
      if (company.address) { doc.text(`Dirección: ${company.address}`, leftTextX, yTmp, { width: colW - (leftTextX - leftX) }); yTmp += 12; }
      if (company.phone) { doc.text(`Teléfono: ${company.phone}`, leftTextX, yTmp, { width: colW - (leftTextX - leftX) }); yTmp += 12; }
      if (company.taxId) { doc.text(`RUT: ${company.taxId}`, leftTextX, yTmp, { width: colW - (leftTextX - leftX) }); yTmp += 12; }
      const leftH = Math.max(logoSize, yTmp - yL);

      // Cliente
      let yR = headerY;
      doc.fillColor(colorPrimary).font(fontBold).fontSize(12).text('Cliente', rightX, yR, { width: colW });
      yR += 16;
      const clientName = data.client || '';
      const clientEmail = String(data.clientEmail || '').trim();
      if (clientName) {
        if (clientEmail) {
          doc.fillColor('blue').font(fontRegular).fontSize(11).text(clientName, rightX, yR, { width: colW, link: `mailto:${clientEmail}`, underline: true });
        } else {
          doc.fillColor(colorPrimary).font(fontRegular).fontSize(11).text(clientName, rightX, yR, { width: colW });
        }
        yR += 14;
      }
      doc.fillColor(colorPrimary).font(fontRegular).fontSize(10);
      if (data.clientAddress) { doc.text(`Dirección: ${data.clientAddress}`, rightX, yR, { width: colW }); yR += 12; }
      if (data.clientPhone) { doc.text(`Teléfono: ${data.clientPhone}`, rightX, yR, { width: colW }); yR += 12; }
      if (data.clientTaxId) { doc.text(`RUT: ${data.clientTaxId}`, rightX, yR, { width: colW }); yR += 12; }
      const rightH = yR - headerY;

      const headerHeightUsed = Math.max(leftH, rightH);

  // ==============================================================
  // Rectángulo de título: 0.5 cm abajo del membrete, alto 1.8 cm
  // Título principal, fecha y título derivado del contenido.
  // ==============================================================
      const titleGap = cm(0.5);
      const titleH = cm(1.8);
      const titleY = headerY + headerHeightUsed + titleGap;
      doc.save().lineWidth(0.5).strokeColor(colorRule).rect(contentX, titleY, contentW, titleH).stroke().restore();
      const fechaDoc = new Date(data.saved_at || data.created_at || Date.now());
      const mainTitle = `Propuesta de Cotización ${data.quoteNumber || ''}`.trim();
      doc.font(fontBold).fontSize(14).fillColor(colorPrimary).text(mainTitle, contentX, titleY + 8, { width: contentW, align: 'center' });
      doc.font(fontRegular).fontSize(10).fillColor(colorMuted).text(`Fecha: ${fechaDoc.toLocaleDateString('es-CL')}`, contentX + 8, titleY + 28, { width: contentW - 16, align: 'left' });
      // Título derivado desde data.title o primer ítem
      let derivedTitle = String(data.title || '').trim();
      if (!derivedTitle && Array.isArray(data.items) && data.items.length > 0) {
        derivedTitle = String(data.items[0]?.desc || '').trim().slice(0, 100);
      }
      if (derivedTitle) {
        doc.font(fontRegular).fontSize(11).fillColor(colorPrimary).text(derivedTitle, contentX + 8, titleY + 42, { width: contentW - 16 });
      }

  // Flag para identificar si la página tiene contenido útil (evitar footer en páginas vacías)
  let pageHasContent = false;

  // ==============================================================
  // Helpers de pie de página y paginación
  // Dibuja footer solo si hubo contenido; controla salto de página.
  // ==============================================================
  const drawFooterForCurrentPage = () => {
    const y = doc.page.height - margin + 8;
    if (pageHasContent) {
      doc.font(fontRegular).fontSize(8).fillColor(colorMuted).text(company.name || '', margin, y);
      doc.text(`Página ${pageNum}`, doc.page.width - margin - 100, y, { width: 100, align: 'right' });
    }
  };
  const addNewPage = () => {
    // Termina página actual con footer si tuvo contenido
    drawFooterForCurrentPage();
    doc.addPage();
    pageNum += 1;
    pageHasContent = false;
    drawWatermarkBackground();
  };

  // ==============================================================
  // Tabla de ítems (Detalle)
  // Posicionada debajo del título. Columnas alineadas al borde de Totales.
  // ==============================================================
  const tableY = titleY + titleH + cm(0.5);
    doc.fillColor(colorPrimary).font(fontBold).fontSize(12).text('Detalle', margin, tableY);
    pageHasContent = true;

      // Table headers
  const tableHeaderY = tableY + 20;
  // Column layout aligned to totals right edge
  // Right edge of totals numbers = contentX + contentW - 20
  const rightEdge = contentX + contentW - 20;
  const gapCols = 10;
  const colSubtotalW = 70;
  const colVUnitW = 60;
  const colDiscW = 36;
  const colQtyW = 36;
  const xSubtotal = rightEdge - colSubtotalW;
  const xVUnit = xSubtotal - gapCols - colVUnitW;
  const xDisc = xVUnit - gapCols - colDiscW;
  const xQty = xDisc - gapCols - colQtyW;
  const descColX = contentX + 4;
  const descColW = Math.max(80, xQty - gapCols - descColX);

  // Header background
  doc.save().rect(contentX, tableHeaderY - 4, contentW, 18).fill(colorTableHeader).restore();
  doc.font(fontBold).fillColor(colorPrimary).fontSize(9);
  doc.text('Descripción', descColX, tableHeaderY);
  doc.text('Cant.', xQty, tableHeaderY, { width: colQtyW, align: 'right' });
  doc.text('Desc.%', xDisc, tableHeaderY, { width: colDiscW, align: 'right' });
  doc.text('V.Unit.', xVUnit, tableHeaderY, { width: colVUnitW, align: 'right' });
  doc.text('Subtotal', xSubtotal, tableHeaderY, { width: colSubtotalW, align: 'right' });

      // Draw header line
  doc.moveTo(contentX, tableHeaderY + 15).lineTo(contentX + contentW, tableHeaderY + 15).stroke(colorRule);

      // Items
  let currentY = tableHeaderY + 25;
      const bottomLimit = doc.page.height - margin - 200; // reserve for totals/QR
      const drawRow = (item, idx) => {
        const subtotal = (item.qty || 0) * (item.price || 0) * (1 - ((item.discount || 0) / 100));
        const descHeight = doc.heightOfString(item.desc || '', { width: descColW });
        const rowHeight = Math.max(descHeight, 18) + 8;
        if (currentY + rowHeight > bottomLimit) {
          addNewPage();
          // re-draw header on new page
          const headerY2 = margin;
          doc.fillColor(colorPrimary).font(fontBold).fontSize(12).text('Detalle (cont.)', contentX, headerY2);
          pageHasContent = true;
          const thY2 = headerY2 + 20;
          doc.save().rect(contentX, thY2 - 4, contentW, 18).fill(colorTableHeader).restore();
          doc.font(fontBold).fillColor(colorPrimary).fontSize(9);
          doc.text('Descripción', descColX, thY2);
          doc.text('Cant.', xQty, thY2, { width: colQtyW, align: 'right' });
          doc.text('Desc.%', xDisc, thY2, { width: colDiscW, align: 'right' });
          doc.text('V.Unit.', xVUnit, thY2, { width: colVUnitW, align: 'right' });
          doc.text('Subtotal', xSubtotal, thY2, { width: colSubtotalW, align: 'right' });
          doc.moveTo(contentX, thY2 + 15).lineTo(contentX + contentW, thY2 + 15).stroke(colorRule);
          currentY = thY2 + 25;
        }
        if (idx % 2 === 1) {
          doc.save().rect(contentX, currentY - 4, contentW, rowHeight).fill(colorZebra).restore();
        }
        doc.font(fontRegular).fillColor(colorPrimary).fontSize(9);
        doc.text(item.desc || '', descColX, currentY, { width: descColW, align: 'justify' });
        doc.text(String(item.qty || 0), xQty, currentY, { width: colQtyW, align: 'right' });
        doc.text(`${formatNumberDot(item.discount || 0)}%`, xDisc, currentY, { width: colDiscW, align: 'right' });
        doc.text(formatAmount(item.price || 0, data.currency || 'CLP'), xVUnit, currentY, { width: colVUnitW, align: 'right' });
        doc.text(formatAmount(Math.round(subtotal * 100) / 100, data.currency || 'CLP'), xSubtotal, currentY, { width: colSubtotalW, align: 'right' });
        currentY += rowHeight;
      };
      if (Array.isArray(data.items)) {
        data.items.forEach((it, idx) => drawRow(it, idx));
      }

      // Totals with proper alignment
  // ==============================================================
  // Totales y QR de aprobación
  // QR se oculta si la cotización está aceptada.
  // ==============================================================
  const totalsY = currentY + 20;
    const totalsX = contentX + contentW - 240;
    const boxW = 220;
    const boxH = 80;
    doc.save().rect(totalsX - 10, totalsY - 10, boxW + 20, boxH + 20).fill(colorTotalsBg).restore();
    doc.font(fontRegular).fillColor(colorPrimary).fontSize(10);
    doc.text('Neto:', totalsX, totalsY);
    doc.text(`${formatAmount(data.net || 0, data.currency || 'CLP')}`, totalsX + 120, totalsY, { width: 100, align: 'right' });
    doc.text('IVA (19%):', totalsX, totalsY + 16);
    doc.text(`${formatAmount(data.tax || 0, data.currency || 'CLP')}`, totalsX + 120, totalsY + 16, { width: 100, align: 'right' });
    doc.font(fontBold).fontSize(12).text('TOTAL:', totalsX, totalsY + 36);
    doc.font(fontBold).text(`${formatAmount(data.total || 0, data.currency || 'CLP')}`, totalsX + 120, totalsY + 36, { width: 100, align: 'right' });

      // Currency conversion if not CLP
      if (data.currency && data.currency !== 'CLP') {
        if (data.currency === 'UF') {
          const clp = data.totalInCLP || Math.round((data.total || 0) * ufRate);
          doc.font(fontRegular).fontSize(9).fillColor(colorMuted).text(`En CLP ${formatNumberDot(clp, 0)}`, totalsX, totalsY + 56, { align: 'right', width: 220 });
        } else if (data.currency === 'USD') {
          const clp = data.totalInCLP || Math.round((data.total || 0) * usdRate);
          doc.font(fontRegular).fontSize(9).fillColor(colorMuted).text(`En CLP ${formatNumberDot(clp, 0)}`, totalsX, totalsY + 56, { align: 'right', width: 220 });
        }
      }

      // QR al nivel del TOTAL, margen izquierdo (oculto si está aceptada)
      let afterTotalsY = totalsY + boxH + 20;
      if (!data.approvedAt) {
        const qrSize = 120;
        const qrX = margin; // margen izquierdo
  const qrY = totalsY - 10; // alinear con borde superior del área sombreada de totales
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const acceptUrl = baseUrl.replace(/\/$/, '') + '/accept?file=' + data.quoteNumber + '.json&token=' + data.token;
        const qrPath = path.join(OUTPUTS_DIR, `${data.quoteNumber}_qr.png`);
        await QRCode.toFile(qrPath, acceptUrl);
        if (fs.existsSync(qrPath)) {
          // Etiqueta encima del QR
          doc.font(fontRegular).fontSize(8).fillColor(colorMuted).text('Escanee o Haga Click', qrX, qrY - 12, { width: qrSize, align: 'center' });
          doc.image(qrPath, qrX, qrY, { width: qrSize, height: qrSize });
          doc.link(qrX, qrY, qrSize, qrSize, acceptUrl);
          doc.fillColor(colorPrimary).fontSize(9);
          // El contenido que sigue debe comenzar después del área más baja entre el QR y el total
          afterTotalsY = Math.max(afterTotalsY, qrY + qrSize + 18);
          pageHasContent = true;
        }
      }

  // ==============================================================
  // Dos columnas: Especificaciones (izq) y Condiciones (der)
  // Regla: Si NO hay Especificaciones y SÍ hay Condiciones/Términos,
  //        se renderiza la columna derecha en la IZQUIERDA (bloque preferente).
  // Los textos se limpian para evitar caracteres no legibles.
  // ==============================================================
      const sectionStartY = afterTotalsY + cm(0.5);
      const reserveBottom = 30;
      const getBottomLimit = () => doc.page.height - margin - reserveBottom;
      const colPad = 8;
      const colInnerW = colW - colPad * 2;
      const isImageUrl = (url) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(url || '');
      const cleanText = (val) => String(val || '')
        .replace(/\p{C}+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Preparar contenido de columnas
      const leftSpecs = (Array.isArray(data.specs) ? data.specs : []).filter(sp => {
        if (sp.type === 'text') return cleanText(sp.value).length > 0;
        if (sp.type === 'link') return cleanText(sp.url).length > 0;
        return false;
      });
      let termsText = company.terms || '';
      if (termsText) {
        termsText = termsText.split(/\r?\n/).filter(line => !/vigenc|validez/i.test(line)).join('\n');
      }
      if (data.isRequiredPrepayment && data.prepaymentValue) {
        const anticipo = formatAmount(data.prepaymentValue, data.currency || 'CLP');
        termsText += `\n\nPagar Anticipo de ${anticipo} y el saldo a fin de mes de ejecución.`;
      }
      const rightBlocks = [];
      if (Array.isArray(data.conditionsList) && data.conditionsList.length > 0) {
        for (const c of data.conditionsList) {
          const t = cleanText(c);
          if (t) rightBlocks.push(`• ${t}`);
        }
      } else if (data.conditions) {
        String(data.conditions).split(/\r?\n/).forEach(line => {
          const t = cleanText(line);
          if (t) rightBlocks.push(`• ${t}`);
        });
      }
      if (termsText) {
        termsText.split(/\n+/).forEach(p => {
          const t = cleanText(p);
          if (t) rightBlocks.push(t);
        });
      }
      if (data.validDays) {
        const extra = data.expires_at ? ` (vence el ${new Date(data.expires_at).toLocaleDateString('es-CL')})` : '';
        const t = cleanText(`Vigencia: ${Number(data.validDays)} días hábiles desde la emisión${extra}.`);
        if (t) rightBlocks.push(t);
      }
      if (data.prepaymentRef) {
        const t = cleanText(`Referencia de prepago: ${data.prepaymentRef}`);
        if (t) rightBlocks.push(t);
      }

  const hasLeft = leftSpecs.length > 0;
  const hasRightRaw = rightBlocks.length > 0;
  const placeRightInLeft = !hasLeft && hasRightRaw;
  const hasRightEff = hasRightRaw && !placeRightInLeft;

  let yLCol = sectionStartY;
  let yRCol = sectionStartY;
      const drawColumnHeaders = (cont = false) => {
        doc.font(fontBold).fontSize(11).fillColor(colorPrimary);
        if (hasLeft || placeRightInLeft) {
          // Si no hay specs pero sí condiciones, el título de la columna izquierda es "Condiciones"
          const title = placeRightInLeft
            ? (cont ? 'Condiciones (cont.)' : 'Condiciones')
            : (cont ? 'Especificaciones (cont.)' : 'Especificaciones');
          doc.text(title, leftX, sectionStartY);
          doc.fillColor(colorRule).moveTo(leftX, sectionStartY + 12).lineTo(leftX + colW, sectionStartY + 12).stroke();
          doc.fillColor(colorPrimary);
          yLCol = sectionStartY + 18;
          pageHasContent = true;
        }
        if (hasRightEff) {
          const title = cont ? 'Condiciones (cont.)' : 'Condiciones';
          doc.font(fontBold).fontSize(11).fillColor(colorPrimary).text(title, rightX, sectionStartY);
          doc.fillColor(colorRule).moveTo(rightX, sectionStartY + 12).lineTo(rightX + colW, sectionStartY + 12).stroke();
          doc.fillColor(colorPrimary);
          yRCol = sectionStartY + 18;
          pageHasContent = true;
        }
      };

      const ensureColSpace = (needH) => {
        const bottomLimit = getBottomLimit();
        if ((hasLeft && yLCol + needH > bottomLimit) || (hasRightEff && yRCol + needH > bottomLimit)) {
          addNewPage();
          // en nueva página, reimprimir encabezados de columnas
          drawColumnHeaders(true);
        }
      };

      // Dibuja columnas si hay contenido
      if (hasLeft || hasRightRaw) {
        drawColumnHeaders(false);
      }

      // Render izquierda (Especificaciones) numeradas 1., 2., ...
      // Regla: si una especificación de texto contiene un link, se usa el texto como ancla clickeable; no se agrega como bullet separado.
      const findFirstUrl = (t) => {
        const m = String(t||'').match(/https?:\/\/[^\s]+/i); return m ? m[0] : '';
      };
      for (let i = 0; i < leftSpecs.length; i++) {
        const sp = leftSpecs[i];
        const prefix = `${i + 1}. `;
        if (sp.type === 'text') {
          const raw = String(sp.value || '');
          let url = findFirstUrl(raw);
          // Si el siguiente elemento es un link (no imagen) y el texto no trae URL, combinarlo
          const next = leftSpecs[i + 1];
          if (!url && next && next.type === 'link') {
            const nextUrl = String(next.url || '');
            if (nextUrl && !isImageUrl(nextUrl)) {
              url = nextUrl;
              i++; // saltamos el elemento link para no crear bullet aparte
            }
          }
          const label = cleanText(raw.replace(url, '').trim()) || cleanText(raw);
          const toMeasure = `${prefix}${label}`;
          const h = doc.heightOfString(toMeasure, { width: colInnerW });
          ensureColSpace(h + 6);
          if (url) {
            // Dibuja texto clickeable (una sola línea/bloque)
            doc.fillColor(colorPrimary).font(fontRegular).fontSize(9)
              .text(`${prefix}${label}`, leftX + colPad, yLCol, { width: colInnerW, link: url, underline: true, align: 'justify' });
          } else {
            doc.fillColor(colorPrimary).font(fontRegular).fontSize(9)
              .text(`${prefix}${label}`, leftX + colPad, yLCol, { width: colInnerW, align: 'justify' });
          }
          yLCol += h + 6; pageHasContent = true;
        } else if (sp.type === 'link') {
          const url = String(sp.url || '');
          if (isImageUrl(url)) {
            try {
              const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 6000 });
              const buf = Buffer.from(resp.data);
              const maxH = 100;
              ensureColSpace(maxH + 6);
              doc.image(buf, leftX + colPad, yLCol, { fit: [colInnerW, maxH] });
              yLCol += maxH + 6; pageHasContent = true;
            } catch (_) {
              // Si falla la imagen, mostramos el número + etiqueta clickeable
              const label = `${prefix}Referencia ${i + 1}`;
              const h = 14; ensureColSpace(h);
              doc.fillColor('blue').font(fontRegular).fontSize(9)
                .text(label, leftX + colPad, yLCol, { width: colInnerW, link: url, underline: true });
              doc.fillColor(colorPrimary);
              yLCol += h; pageHasContent = true;
            }
          } else if (url) {
            const label = `${prefix}Referencia ${i + 1}`;
            const h = 14; ensureColSpace(h);
            doc.fillColor('blue').font(fontRegular).fontSize(9)
              .text(label, leftX + colPad, yLCol, { width: colInnerW, link: url, underline: true });
            doc.fillColor(colorPrimary);
            yLCol += h; pageHasContent = true;
          }
        }
      }

      // Render derecha (Condiciones, Términos, Vigencia, Ref. de prepago)
      // Enumeradas con letras mayúsculas: A., B., C., ... (más de 26: AA., AB., ...)
      const letterIndex = (n) => {
        // 0 -> A, 25 -> Z, 26 -> AA
        let s = '';
        let x = n;
        do {
          s = String.fromCharCode(65 + (x % 26)) + s;
          x = Math.floor(x / 26) - 1;
        } while (x >= 0);
        return s;
      };
      for (let i = 0; i < rightBlocks.length; i++) {
        const base = cleanText(String(rightBlocks[i] || ''));
        if (!base) continue;
        const pref = `${letterIndex(i)}. `;
        const text = `${pref}${base}`;
        const h = doc.heightOfString(text, { width: colInnerW });
        ensureColSpace(h + 6);
        if (placeRightInLeft) {
          doc.font(fontRegular).fontSize(9).fillColor(colorPrimary)
            .text(text, leftX + colPad, yLCol, { width: colInnerW, align: 'justify' });
          yLCol += h + 6; pageHasContent = true;
        } else {
          doc.font(fontRegular).fontSize(9).fillColor(colorPrimary)
            .text(text, rightX + colPad, yRCol, { width: colInnerW, align: 'justify' });
          yRCol += h + 6; pageHasContent = true;
        }
      }

      // Detalles de pago 0.5 cm debajo del bloque de columnas
      let maxColsY = sectionStartY;
      if (hasLeft) maxColsY = Math.max(maxColsY, yLCol);
      if (hasRightRaw) {
        maxColsY = Math.max(maxColsY, placeRightInLeft ? yLCol : yRCol);
      }
      const afterColsY = (hasLeft || hasRightRaw)
        ? (maxColsY + cm(0.5))
        : (afterTotalsY + cm(0.5));
      if (company.paymentDetails) {
        const bottomLimit = getBottomLimit();
        let payY = afterColsY;
        if (afterColsY + 20 > bottomLimit) {
          addNewPage();
          payY = margin;
        }
        const payText = cleanText(company.paymentDetails);
        if (payText) {
          doc.font(fontBold).fontSize(11).fillColor(colorPrimary).text('Detalles de Pago', contentX, payY);
          doc.fillColor(colorRule).moveTo(contentX, payY + 12).lineTo(contentX + contentW, payY + 12).stroke();
          doc.fillColor(colorPrimary).font(fontRegular).fontSize(9);
          doc.text(payText, contentX, payY + 16, { width: contentW, align: 'justify' });
          pageHasContent = true;
        }
      }

      // (QR ya fue colocado arriba si corresponde)

      // Footer with page number
      // Cerrar documento con footer de la última página si aplicaba
      //drawFooterForCurrentPage();

      doc.end();
  stream.on('finish', () => resolve(outPath));
    })().catch(reject);
  });
}

module.exports = { generatePDFWithPDFKit };
