// Prueba con cliente WS real
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { app } = require('../app');
const { attachWs } = require('../lib/ws_attach');

let server; let baseUrl;

before(() => new Promise((resolve) => {
  server = http.createServer(app);
  attachWs(server);
  server.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => server.close(resolve)));

function openWS(path) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(baseUrl.replace('http', 'ws') + path);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

describe('WS endpoints', () => {
  test('WS público /ws-public abre y cierra', async () => {
    const ws = await openWS('/ws-public');
    ws.close();
    await new Promise(r => ws.once('close', r));
  });

  test('WS admin /ws sin token se cierra', async () => {
    // Sin token → el servidor cerrará con 4001 tras handshake
    const ws = await openWS('/ws');
    const closed = new Promise(r => ws.once('close', (code) => r(code)));
    const code = await closed;
    assert.ok([4001, 1008, 1000].includes(code));
  });

  test('WS admin /ws con token válido abre y recibe un evento después de loggear', async () => {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '2m' });
    const ws = await openWS('/ws?token=' + encodeURIComponent(token));
    const got = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout waiting message')), 2000);
      ws.on('message', (data) => {
        try {
          const evt = JSON.parse(String(data));
          clearTimeout(to);
          resolve(evt);
        } catch (e) { /* ignore */ }
      });
    });
    // Provocar un log
    console.log('[ws-test] hello');
    const evt = await got;
    assert.ok(evt && evt.ts && evt.level && evt.type);
    ws.close();
  });
});
