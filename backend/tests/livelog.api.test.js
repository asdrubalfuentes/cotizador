// Prueba API admin de LiveLog (listar/descargar/borrar)
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.OUTPUTS_DIR = path.resolve(__dirname, '..', '..', 'outputs');

const { app } = require('../app');

let server; let baseUrl;

before(() => new Promise((resolve) => {
  server = http.createServer(app);
  server.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => server.close(resolve)));

async function loginAdmin(){
  const r = await fetch(baseUrl + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) });
  const j = await r.json();
  return j.token;
}

describe('Admin LiveLog API', () => {
  test('listar/descargar/borrar', async () => {
    const token = await loginAdmin();
    // Generar algunos eventos
    await fetch(baseUrl + '/api/logs?level=info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg: 'api-test' }) });

    // Listar
    let r = await fetch(baseUrl + '/api/admin/livelog/files', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(r.status, 200)
    let j = await r.json();
    assert.ok(Array.isArray(j.files));
    const day = (j.files.find(f => /livelog-\d{8}\.ndjson/.test(f)) || '').match(/(\d{8})/);
    assert.ok(day && day[1]);

    // Descargar
    r = await fetch(baseUrl + '/api/admin/livelog/file/' + day[1], { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(r.status, 200);
    const txt = await r.text();
    assert.ok(txt.includes('api-test'));

    // Borrar (no fallar si no existe)
    r = await fetch(baseUrl + '/api/admin/livelog/file/' + day[1], { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(r.status, 200);
    j = await r.json();
    assert.ok(typeof j.ok === 'boolean');
  });
});
