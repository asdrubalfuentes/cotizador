#!/usr/bin/env node
/*
 Diagnóstico de stack en producción (frontend cPanel + backend HTTPS)
 - Verifica: CSP del frontend, config.js (window.__APP_CONFIG__), API_BASE vs BACKEND esperado,
   CORS/preflight desde FRONTEND→BACKEND, conectividad del backend (/ y /api/quotes/:file),
   SSE (/api/events).
 - Simulación de /accept: por defecto NO muta (no ejecuta approve/reject). Puedes habilitar pruebas de mutación
   exportando MUTATE=1 y entregando file+token (o acceptUrl). Úsalo sólo si eres consciente de los efectos.

 Uso:
   node backend/scripts/diagnose_prod_stack.js \
     --frontend https://cotizador.aysafi.com \
     --backend https://emqx.aysafi.com:8443 \
     --acceptUrl "https://cotizador.aysafi.com/accept?file=COT-...json&token=..."

 Opcionales:
   - ADMIN_PASSWORD=... para leer /api/config con token admin.
   - SKIP_TLS_VERIFY=1 para ignorar errores TLS (no recomendado salvo pruebas).
   - MUTATE=1 para intentar approve/reject (requiere file+token válidos; cambia estado real).
*/

const axios = require('axios');
const https = require('https');
const { URL } = require('url');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--frontend') out.frontend = args[++i];
    else if (a === '--backend') out.backend = args[++i];
    else if (a === '--acceptUrl') out.acceptUrl = args[++i];
    else if (a === '--file') out.file = args[++i];
    else if (a === '--token') out.token = args[++i];
  }
  // Defaults
  if (!out.frontend) out.frontend = 'https://cotizador.aysafi.com';
  if (!out.backend) out.backend = 'https://emqx.aysafi.com:8443';
  // Parse acceptUrl if present
  if (out.acceptUrl) {
    try {
      const u = new URL(out.acceptUrl);
      out.file = out.file || u.searchParams.get('file');
      out.token = out.token || u.searchParams.get('token');
    } catch { /* ignore */ }
  }
  return out;
}

function agentFor(url) {
  const skip = process.env.SKIP_TLS_VERIFY === '1';
  if (!url.startsWith('https://')) return undefined;
  return new https.Agent({ rejectUnauthorized: !skip });
}

function color(s, c) { return process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s; }
const ok = (s) => console.log(color(`✔ ${s}`, '32'));
const warn = (s) => console.log(color(`! ${s}`, '33'));
const fail = (s) => console.log(color(`✖ ${s}`, '31'));

async function headOrGet(url, cfg) {
  try { return await axios.head(url, cfg); } catch { return await axios.get(url, cfg); }
}

function parseConfigJs(body) {
  // Espera: window.__APP_CONFIG__ = {...};
  const m = body.match(/window\.__APP_CONFIG__\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

async function main() {
  const { frontend, backend, file, token } = parseArgs();
  const mutate = process.env.MUTATE === '1';
  const adminPass = process.env.ADMIN_PASSWORD || '';
  console.log('Diagnóstico producción');
  console.log('FRONTEND:', frontend);
  console.log('BACKEND :', backend);
  if (file) console.log('FILE    :', file);
  if (token) console.log('TOKEN   :', token ? `${token.slice(0,6)}...` : '');
  if (mutate) warn('MUTATE=1 activo: se intentarán operaciones de approve/reject si hay file+token.');

  // 1) Frontend index: headers + CSP
  try {
    const res = await headOrGet(frontend + '/', { httpsAgent: agentFor(frontend), timeout: 15000 });
    const csp = (res.headers['content-security-policy'] || '').slice(0, 200);
    if (csp) ok('Frontend expone Content-Security-Policy'); else warn('Frontend sin CSP (recomendado agregarla).');
  } catch (e) {
    fail(`No se pudo acceder al FRONTEND index: ${e.message}`);
  }

  // 2) Frontend config.js
  let cfg = null;
  try {
    const r = await axios.get(frontend + '/config.js', { httpsAgent: agentFor(frontend), timeout: 15000 });
    cfg = parseConfigJs(r.data || '');
    if (!cfg) warn('config.js presente pero sin window.__APP_CONFIG__ esperado (o configurado en blanco)');
    else ok(`config.js leído: API_BASE='${cfg.API_BASE||''}' FRONTEND_URL='${cfg.FRONTEND_URL||''}'`);
    if (cfg && cfg.API_BASE && cfg.API_BASE !== backend) {
      warn(`API_BASE en config.js no coincide con BACKEND pasado al script. API_BASE='${cfg.API_BASE}', BACKEND='${backend}'`);
    }
  } catch {
    warn('No se pudo leer /config.js (aceptable si se usa config embebida)');
  }

  // 3) CORS/preflight desde FRONTEND→BACKEND para GET/POST quote
  if (file) {
    try {
      const pre = await axios.options(`${backend}/api/quotes/${file}`, {
        httpsAgent: agentFor(backend), timeout: 15000,
        headers: {
          'Origin': frontend,
          'Access-Control-Request-Method': 'GET',
        },
      });
      const allow = pre.headers['access-control-allow-origin'] || '';
      if (allow === '*' || allow === frontend) ok('CORS preflight GET permite origen del frontend');
      else warn(`CORS GET no refleja origen esperado (Allow-Origin='${allow||'-'}')`);
    } catch (e) {
      warn(`Preflight GET falló: ${e.message}`);
    }
    try {
      const pre = await axios.options(`${backend}/api/quotes/${file}/approve`, {
        httpsAgent: agentFor(backend), timeout: 15000,
        headers: {
          'Origin': frontend,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      const allow = pre.headers['access-control-allow-origin'] || '';
      if (allow === '*' || allow === frontend) ok('CORS preflight POST permite origen del frontend');
      else warn(`CORS POST no refleja origen esperado (Allow-Origin='${allow||'-'}')`);
    } catch (e) {
      warn(`Preflight POST falló: ${e.message}`);
    }
  }

  // 4) Backend salud y quote
  try {
    const r = await axios.get(backend + '/', { httpsAgent: agentFor(backend), timeout: 15000 });
    if (r.data && r.data.ok) ok('Backend responde en /'); else warn('Backend / respondió pero sin { ok: true }');
  } catch (e) {
    fail(`Backend no alcanzable en /: ${e.message}`);
  }

  if (file) {
    try {
      const r = await axios.get(`${backend}/api/quotes/${file}`, { httpsAgent: agentFor(backend), timeout: 15000 });
      if (r && r.data && r.data.quoteNumber) ok(`Backend entrega la cotización ${r.data.quoteNumber}`);
      else warn('Backend devolvió la ruta de cotización pero sin datos esperados');
    } catch (e) {
      fail(`No se pudo leer /api/quotes/${file}: ${e.response?.status||''} ${e.message}`);
    }
  }

  // 5) /api/config (si hay ADMIN_PASSWORD)
  if (adminPass) {
    try {
      const login = await axios.post(`${backend}/api/admin/login`, { password: adminPass }, { httpsAgent: agentFor(backend), timeout: 15000 });
      const tokenAdmin = login.data?.token;
      if (!tokenAdmin) throw new Error('sin token admin');
      const r = await axios.get(`${backend}/api/config`, {
        httpsAgent: agentFor(backend), timeout: 15000,
        headers: { Authorization: `Bearer ${tokenAdmin}` }
      });
      ok(`/api/config: ${JSON.stringify(r.data)}`);
    } catch (e) {
      warn(`/api/config no disponible (probablemente requiere admin): ${e.message}`);
    }
  } else {
    warn('ADMIN_PASSWORD no provisto; se omite lectura de /api/config protegida.');
  }

  // 6) SSE
  try {
    const r = await axios.get(`${backend}/api/events`, {
      httpsAgent: agentFor(backend), timeout: 15000, responseType: 'stream'
    });
    const ct = (r.headers['content-type'] || '').toLowerCase();
    if (ct.includes('text/event-stream')) ok('SSE /api/events responde event-stream');
    else warn(`SSE respondió Content-Type inesperado: '${ct||'-'}'`);
    // Cerrar el stream inmediatamente
    r.data.destroy();
  } catch (e) {
    warn(`No se pudo abrir SSE: ${e.message}`);
  }

  // 7) Simular /accept (mutación opcional)
  if (file && token) {
    const code6 = token.slice(-6);
    ok(`Simulación /accept: file='${file}', code6 derivado del token='${code6}'`);
    if (mutate) {
      // Aceptar
      try {
        const r = await axios.post(`${backend}/api/quotes/${file}/approve`, {
          code6, approverName: 'Diagnose Bot', prepayment: 0
        }, { httpsAgent: agentFor(backend), timeout: 15000, headers: { 'Content-Type': 'application/json' } });
        ok(`approve OK: ${JSON.stringify(r.data)}`);
      } catch (e) {
        fail(`approve falló: ${e.response?.status||''} ${e.response?.data?.error||e.message}`);
      }
      // Rechazo (opcional): comentado por defecto
      // try {
      //   const r = await axios.post(`${backend}/api/quotes/${file}/approve`, {
      //     code6, reject: true, reason: 'Rechazo prueba', approverName: 'Diagnose Bot'
      //   }, { httpsAgent: agentFor(backend), timeout: 15000, headers: { 'Content-Type': 'application/json' } });
      //   ok(`reject OK: ${JSON.stringify(r.data)}`);
      // } catch (e) {
      //   fail(`reject falló: ${e.response?.status||''} ${e.response?.data?.error||e.message}`);
      // }
    } else {
      warn('MUTATE=0: no se ejecuta approve/reject reales. Exporta MUTATE=1 para probar mutaciones.');
    }
  } else {
    warn('No se entrega file+token: se omite simulación de /accept.');
  }

  console.log('\nDiagnóstico finalizado.');
}

main().catch(e => { fail(e.message || e); process.exit(1); });
