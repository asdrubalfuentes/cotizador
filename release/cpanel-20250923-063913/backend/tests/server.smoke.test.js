// Basic smoke test for Express app
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app } = require('../app');

let server;
let baseUrl;

before(() => {
  server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET / should return ok true', async () => {
  const res = await fetch(baseUrl + '/');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.ok(json.message.includes('Cotizador'));
});
