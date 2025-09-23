// Seguridad: prueba HTTPS local y recorrido de rutas para detectar fallos básicos
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const path = require('node:path');
const selfsigned = require('selfsigned');

// Preparar entorno seguro y stubs ANTES de cargar la app
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.FRONTEND_URL = 'https://frontend.local.test';
process.env.PUBLIC_API_BASE = 'https://backend.local.test';
process.env.OUTPUTS_DIR = path.resolve(__dirname, '..', '..', 'outputs');

// Stub de email para evitar conexiones SMTP reales
const emailModPath = path.resolve(__dirname, '..', 'utils', 'email.js');
const emailMod = require(emailModPath);
emailMod.sendClientQuoteEmail = async () => ({ ok: true });
emailMod.sendCompanyStateEmail = async () => ({ ok: true });

// Cargar la app una vez stubeado email
const { app } = require('../app');

// Certificado autofirmado generado en runtime
const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 1, keySize: 2048, algorithm: 'sha256' });
const CERT = pems.cert;
const KEY = pems.private;

let server; let baseUrl;

before(() => new Promise((resolve) => {
  // Aceptar certs autofirmados en fetch
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  server = https.createServer({ cert: CERT, key: KEY }, app);
  server.listen(0, () => {
    baseUrl = `https://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => server.close(resolve)));

async function getText(url) {
  const res = await fetch(url);
  const txt = await res.text();
  return { res, txt };
}

// (si se requiere, se puede añadir un helper getJSON)

describe('HTTPS smoke + seguridad básica', () => {
  test('GET / ok y sin http:// en body', async () => {
    const { res, txt } = await getText(baseUrl + '/');
    assert.equal(res.status, 200);
    assert.match(txt, /Cotizador backend/);
    assert.equal(/http:\/\//i.test(txt), false);
  });

  test('Sirve index.html sin http://', async () => {
    const { res, txt } = await getText(baseUrl + '/index.html');
    assert.equal(res.status, 200);
    assert.ok(/<html/i.test(txt));
    assert.equal(/http:\/\//i.test(txt), false);
  });

  test('Rutas SPA (ej. /admin/login) sirven index.html y sin http://', async () => {
    const { res, txt } = await getText(baseUrl + '/admin/login');
    assert.equal(res.status, 200);
    assert.ok(/<html/i.test(txt));
    assert.equal(/http:\/\//i.test(txt), false);
  });

  test('GET /config.js válido y sin http://', async () => {
    const { res, txt } = await getText(baseUrl + '/config.js');
    assert.equal(res.status, 200);
    assert.match(txt, /window.__APP_CONFIG__/);
    assert.equal(/http:\/\//i.test(txt), false);
  });

  test('Auth admin y /api/config protegido', async () => {
    // Sin token → 401
    let r = await fetch(baseUrl + '/api/config');
    assert.equal(r.status, 401);
    // Con login
    r = await fetch(baseUrl + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-password' })
    });
    assert.equal(r.status, 200);
    const { token } = await r.json();
    const rc = await fetch(baseUrl + '/api/config', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(rc.status, 200);
  });

  test('SSE /api/events responde event-stream', async () => {
    const ctrl = new AbortController();
    const res = await fetch(baseUrl + '/api/events', { signal: ctrl.signal });
    assert.equal(res.status, 200);
    const ctype = res.headers.get('content-type') || '';
    assert.ok(ctype.includes('text/event-stream'));
    ctrl.abort();
  });

  test('Logs y upload logo', async () => {
    let r = await fetch(baseUrl + '/api/logs?level=info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg: 'hello' }) });
    assert.equal(r.status, 200);
    // upload
    const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
    const fd = new FormData();
    fd.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');
    r = await fetch(baseUrl + '/api/upload/logo', { method: 'POST', body: fd });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
  });

  test('Empresa CRUD', async () => {
    const login = await fetch(baseUrl + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) });
    const { token } = await login.json();
    let r = await fetch(baseUrl + '/api/empresa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'ACME', email: 'acme@example.com' }) });
    assert.equal(r.status, 200);
    const created = await r.json();
    const id = created.empresa.id;
    r = await fetch(baseUrl + '/api/empresa');
    assert.equal(r.status, 200);
    r = await fetch(baseUrl + `/api/empresa/${id}`);
    assert.equal(r.status, 200);
    r = await fetch(baseUrl + `/api/empresa/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone: '+56 9 1234 5678' }) });
    assert.equal(r.status, 200);
    r = await fetch(baseUrl + `/api/empresa/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(r.status, 200);
  });

  test('Items CRUD', async () => {
    let r = await fetch(baseUrl + '/api/items');
    assert.equal(r.status, 200);
    r = await fetch(baseUrl + '/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Servicio X', price: 1000 }) });
    assert.equal(r.status, 200);
    const { item } = await r.json();
    r = await fetch(baseUrl + `/api/items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: 1200 }) });
    assert.equal(r.status, 200);
    r = await fetch(baseUrl + `/api/items/${item.id}`, { method: 'DELETE' });
    assert.equal(r.status, 200);
  });

  test('Quotes flujo completo (crear, leer, actualizar, aprobar/rechazar, borrar)', async () => {
    // Crear
    let r = await fetch(baseUrl + '/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'Tester', clientEmail: 'tester@example.com', items: [], total: 1000, currency: 'CLP' })
    });
    assert.equal(r.status, 200);
    let { file, token } = await r.json();
    const code6 = token.slice(-6);

    // Detalle
    r = await fetch(baseUrl + `/api/quotes/${file}`);
    assert.equal(r.status, 200);

    // Update
    const current = await r.json();
    current.total = 1500;
    r = await fetch(baseUrl + `/api/quotes/${file}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
    assert.equal(r.status, 200);

    // Rechazar
    r = await fetch(baseUrl + `/api/quotes/${file}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code6, reject: true, reason: 'No me sirve', approverName: 'QA' }) });
    assert.equal(r.status, 200);
    let jr = await r.json();
    assert.equal(jr.rejected, true);

    // Aceptar → needsReview (porque estaba rechazada)
    r = await fetch(baseUrl + `/api/quotes/${file}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code6, approverName: 'QA' }) });
    assert.equal(r.status, 200);
    jr = await r.json();
    assert.equal(jr.needsReview, true);

    // Aceptar nuevamente → approved (regenerated)
    r = await fetch(baseUrl + `/api/quotes/${file}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code6, approverName: 'QA' }) });
    assert.equal(r.status, 200);
    jr = await r.json();
    assert.equal(jr.regenerated, true);

    // Static JSON
    r = await fetch(baseUrl + `/outputs/${file}`);
    assert.equal(r.status, 200);

    // Borrar
    r = await fetch(baseUrl + `/api/quotes/${file}`, { method: 'DELETE' });
    assert.equal(r.status, 200);
  });

  test('next_ref y listado quotes', async () => {
    let r = await fetch(baseUrl + '/api/quotes/next_ref');
    assert.equal(r.status, 200);
    r = await fetch(baseUrl + '/api/quotes');
    assert.equal(r.status, 200);
    const arr = await r.json();
    assert.ok(Array.isArray(arr));
  });
});
