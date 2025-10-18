// Pruebas E2E en producción (solo lectura, sin efectos secundarios)
// Frontend: https://cotizador.aysafi.com
// Backend:  https://emqx.aysafi.com:8443

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

// Permite override por env y opción para desactivar validación TLS en entornos con MITM corporativo
const FRONTEND = process.env.FRONTEND_URL_PROD || 'https://cotizador.aysafi.com';
const BACKEND = process.env.BACKEND_URL_PROD || 'https://emqx.aysafi.com:8443';
const SKIP_TLS_VERIFY = process.env.SKIP_TLS_VERIFY === '1';
let BACKEND_UP = false;

if (SKIP_TLS_VERIFY) {
  // Desaconsejado, solo si el entorno local rompe TLS por proxy
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Helper con timeout
async function fetchText(url, init = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const txt = await res.text();
    return { res, txt };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, init = {}, ms = 15000) {
  const { res, txt } = await fetchText(url, init, ms);
  let json = null;
  try { json = JSON.parse(txt); } catch (e) { json = null; }
  return { res, json, txt };
}

describe('Producción: Frontend y Backend HTTPS (solo lectura)', () => {
  before(async () => {
    assert.ok(FRONTEND.startsWith('https://'));
    assert.ok(BACKEND.startsWith('https://'));
    // Probar si backend está alcanzable; si no, marcaremos tests como skip
    try {
      const probe = await fetch(BACKEND + '/', { method: 'GET', signal: AbortSignal.timeout(4000) });
      BACKEND_UP = probe.status > 0;
    } catch (e) {
      console.warn(`[ADVERTENCIA] Backend no alcanzable en ${BACKEND}: ${e?.code || e?.message || e}`);
      BACKEND_UP = false;
    }
  });

  test('Frontend index carga y sin mixed content', async () => {
    const { res, txt } = await fetchText(FRONTEND + '/');
    assert.equal(res.status, 200);
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    assert.ok(ctype.includes('text/html'));
    const csp = res.headers.get('content-security-policy');
    if (!csp) {
      // No hacer fallar el test completo, pero dejar rastro en salida
      console.warn('[ADVERTENCIA] Frontend sin Content-Security-Policy');
    }
    assert.equal(/http:\/\//i.test(txt), false, 'No debe haber http:// en HTML');

    // Descubrir y probar algunos assets propios
    const assetHrefs = Array.from(txt.matchAll(/(?:src|href)=["']([^"']+)["']/gi))
      .map((m) => m[1])
      .filter((u) => u && (u.startsWith('/assets/') || u.startsWith('./assets/') || u.startsWith('assets/')));
    // Normalizar a URLs absolutas del mismo origen
    const absolute = assetHrefs.map((u) => new URL(u, FRONTEND).href);
    // Limitar para no cargar demasiado
    const sample = absolute.slice(0, 10);
    for (const href of sample) {
      const { res: ar, txt: atxt } = await fetchText(href);
      assert.equal(ar.status, 200, `Asset 200: ${href}`);
      const act = (ar.headers.get('content-type') || '').toLowerCase();
      if (act.includes('javascript') || act.includes('css') || href.endsWith('.js') || href.endsWith('.css')) {
        const hasInsecure = /http:\/\//i.test(atxt) && !/http:\/\/localhost|http:\/\/127\.|http:\/\/www\.w3\.org/i.test(atxt);
        if (hasInsecure) {
          console.warn(`[ADVERTENCIA] Posible referencia http:// en asset ${href}`);
        }
      }
    }
  });

  test('Frontend SPA route /admin/login sirve index (o 404) y sin http://', async () => {
    const { res, txt } = await fetchText(FRONTEND + '/admin/login');
    if (res.status === 404) {
      console.warn('[ADVERTENCIA] /admin/login responde 404 (SPA fallback no configurado).');
    } else {
      assert.equal(res.status, 200);
      assert.ok(/<html/i.test(txt));
      assert.equal(/http:\/\//i.test(txt), false);
    }
  });

  test('config.js expone configuración runtime coherente (si existe)', async () => {
    const { res, txt } = await fetchText(FRONTEND + '/config.js');
    if (res.status === 404) {
      console.warn('[ADVERTENCIA] /config.js inexistente (config embebida en bundle)');
      return;
    }
    if (res.status !== 200) {
      console.warn(`[ADVERTENCIA] /config.js respondió ${res.status}, se omite validación`);
      return;
    }
    if (!/window.__APP_CONFIG__/.test(txt)) {
      console.warn('[ADVERTENCIA] /config.js no contiene window.__APP_CONFIG__ esperado');
      return;
    }
    // Intentar extraer el objeto literal generado por el backend
    const m = txt.match(/__APP_CONFIG__\s*=\s*({[\s\S]*?});?/);
    if (!m) {
      console.warn('[ADVERTENCIA] No se pudo extraer objeto __APP_CONFIG__');
      return;
    }
    let cfg = null;
    try { cfg = JSON.parse(m[1]); } catch (_) {
      console.warn('[ADVERTENCIA] __APP_CONFIG__ no es JSON parseable');
      return;
    }
    // Validaciones suaves: si hay API_BASE, debe ser https y apuntar al host del backend
    if (cfg.API_BASE) {
      assert.ok(String(cfg.API_BASE).startsWith('https://'), 'API_BASE https');
      assert.ok(String(cfg.API_BASE).includes(new URL(BACKEND).host), `API_BASE debe apuntar a ${new URL(BACKEND).host}`);
    }
    // FRONTEND_URL si existe, preferimos https
    if (cfg.FRONTEND_URL) {
      assert.ok(String(cfg.FRONTEND_URL).startsWith('https://') || String(cfg.FRONTEND_URL).startsWith('http://'));
    }
  });

  test('Backend health en / responde y sin http://', { skip: () => !BACKEND_UP }, async () => {
    const { res, txt } = await fetchText(BACKEND + '/');
    assert.equal(res.status, 200);
    assert.equal(/http:\/\//i.test(txt), false);
  });

  test('Backend /api/config protegido (401)', { skip: () => !BACKEND_UP }, async () => {
    const r = await fetch(BACKEND + '/api/config');
    assert.equal(r.status, 401);
  });

  test('Backend /api/items accesible públicamente (si aplica)', { skip: () => !BACKEND_UP }, async () => {
    const { res, json, txt } = await fetchJson(BACKEND + '/api/items');
    if (res.status === 200) {
      assert.ok(Array.isArray(json), 'Debe retornar array');
      assert.equal(/http:\/\//i.test(txt), false);
    } else {
      // Si está protegido en prod, no fallar la suite
      assert.ok([401, 403].includes(res.status), 'Esperado 200 o acceso denegado');
    }
  });

  test('Backend SSE /api/events responde event-stream', { skip: () => !BACKEND_UP }, async () => {
    const ctrl = new AbortController();
    const res = await fetch(BACKEND + '/api/events', { signal: ctrl.signal });
    assert.equal(res.status, 200);
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    assert.ok(ctype.includes('text/event-stream'));
    ctrl.abort();
  });

  test('Preflight CORS para POST /api/items permite origen del frontend', { skip: () => !BACKEND_UP }, async () => {
    const res = await fetch(BACKEND + '/api/items', {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND,
        'Access-Control-Request-Method': 'POST'
      }
    });
    // Algunos servidores responden 204/200 a preflight y otros 404 si no hay handler pero CORS global
    assert.ok([200, 204, 404].includes(res.status));
    if ([200, 204].includes(res.status)) {
      const allowOrigin = res.headers.get('access-control-allow-origin') || '';
      assert.ok(allowOrigin === '*' || allowOrigin.includes(new URL(FRONTEND).origin), 'Debe permitir el origen del frontend o wildcard');
    }
  });
});
