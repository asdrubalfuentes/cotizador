#!/usr/bin/env node
/*
 Clona parcialmente una cotización y crea una nueva en el backend remoto.
 Uso:
   node backend/scripts/diagnose_clone_create_quote.js \
     --backend https://emqx.aysafi.com:8443 [--file COT-....json]

 Notas:
 - Marca el contenido como TEST para minimizar impacto.
 - Usa currency='UF' por defecto para forzar llamadas a tasas (si el backend no tiene el hotfix) y observar errores.
 - Requiere conectividad al BACKEND; no modifica frontend.
 */

const axios = require('axios');
const https = require('https');

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { backend: 'https://emqx.aysafi.com:8443', file: '', currency: 'UF' };
  for(let i=0;i<args.length;i++){
    const a = args[i];
    if(a==='--backend') out.backend = args[++i];
    else if(a==='--file') out.file = args[++i];
    else if(a==='--currency') out.currency = args[++i];
  }
  return out;
}

function agentFor(url){
  const skip = process.env.SKIP_TLS_VERIFY === '1';
  if (!url.startsWith('https://')) return undefined;
  return new https.Agent({ rejectUnauthorized: !skip });
}

function pickNewest(quotes){
  if(!Array.isArray(quotes) || quotes.length===0) return null;
  return quotes.slice().sort((a,b)=> new Date(b.saved_at||b.created_at||0) - new Date(a.saved_at||a.created_at||0))[0];
}

async function main(){
  const { backend, file: fileArg, currency } = parseArgs();
  const httpsAgent = agentFor(backend);
  console.log('Clone-create diagnose against', backend, 'currency=', currency);

  // 1) Obtener listado de cotizaciones
  let targetFile = fileArg;
  if(!targetFile){
    const listRes = await axios.get(backend + '/api/quotes', { httpsAgent, timeout: 20000 });
    const newest = pickNewest(listRes.data || []);
    if(!newest) throw new Error('No hay cotizaciones para clonar');
    targetFile = newest.file;
    console.log('Usando más reciente:', targetFile);
  }

  // 2) Leer la cotización original
  const origRes = await axios.get(`${backend}/api/quotes/${encodeURIComponent(targetFile)}`, { httpsAgent, timeout: 20000 });
  const orig = origRes.data || {};
  console.log('Original quoteNumber:', orig.quoteNumber);

  // 3) Construir nuevo body de prueba
  const now = new Date();
  const testBody = {
    client: `TEST CLONE ${now.toISOString()}`,
    clientEmail: 'no-reply+clone@example.com',
    clientAddress: orig.clientAddress || '',
    clientPhone: orig.clientPhone || '',
    clientTaxId: '',
    companyId: orig.companyId,
  currency: currency || 'UF', // permite forzar CLP para aislar tasas
    title: `TEST CLONE - ${String(orig.title||'').slice(0,60)}`,
    items: Array.isArray(orig.items) && orig.items.length>0 ? [
      {
        desc: `TEST CLONE de ${String(orig.items[0].desc||'item').slice(0,40)}`,
        qty: 1,
        price: Number(orig.items[0].price||10000) || 10000,
        discount: 0
      }
    ] : [
      { desc: 'TEST CLONE ITEM', qty: 1, price: 10000, discount: 0 }
    ],
    validDays: 1,
    net: 8400,
    tax: 1600,
    total: 10000,
    isRequiredPrepayment: false,
    conditions: 'TEST - NO PROCESAR',
    specs: []
  };

  console.log('POST /api/quotes con body TEST...');
  try{
    const r = await axios.post(backend + '/api/quotes', testBody, {
      httpsAgent,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Respuesta:', r.status, r.data);
  }catch(e){
    const status = e.response?.status;
    const data = e.response?.data;
    console.error('Fallo POST /api/quotes:', status || '', data || '', e.message);
    process.exitCode = 1;
  }
}

main().catch(e=>{ console.error(e.message||e); process.exit(1); });
