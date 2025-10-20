const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { connect, getQuotesCollection, close } = require('../lib/db/mongo');
const { migrateBack } = require('../scripts/migrate_mongo_to_file');

test('migrate mongo -> file writes JSON files', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotizador-migrate-'));
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await connect(uri, 'cotizador_test');
  const col = await getQuotesCollection();
  const ref = 'COTTEST-2025-000001';
  await col.insertOne({ quoteNumber: ref, client: 'Cliente', total: 1000, saved_at: new Date().toISOString() });

  const res = await migrateBack({ memory: false, uri, db: 'cotizador_test', dest: tmpDir });
  assert.equal(res.ok, true);
  const f = path.join(tmpDir, `${ref}.json`);
  assert.equal(fs.existsSync(f), true);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(j.quoteNumber, ref);

  await close();
  await mongod.stop();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
