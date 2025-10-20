const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { listQuotes, readJSON } = require('../lib/storage');
const { connect, getQuotesCollection, close } = require('../lib/db/mongo');
const { MongoMemoryServer } = require('mongodb-memory-server');

function bar(ms, max) {
  const width = 40;
  const ratio = Math.min(1, ms / max);
  const filled = Math.round(width * ratio);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function measure(fn, iters = 50) {
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) await fn(i);
  const t1 = performance.now();
  return (t1 - t0) / iters;
}

test('perf repo compare (file vs mongo) [ASCII report]', async (t) => {
  // Preparar un pequeño set: usa lo que haya en outputs como base
  const files = listQuotes().slice(0, 50);
  assert.ok(files.length >= 0);

  // Métrica file: readJSON por archivo
  const fileAvg = files.length > 0
    ? await measure(async (i) => { readJSON(files[i % files.length].file); }, 100)
    : 0;

  // Preparar Mongo con esos documentos
  let mongod;
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await connect(uri, 'cotizador_perf');
  } catch (err) {
    t.skip('mongodb-memory-server no disponible, se omite el test de performance');
    return;
  }

  const col = await getQuotesCollection();
  await col.deleteMany({});
  for (const f of files) {
    const j = readJSON(f.file);
    if (j) await col.updateOne({ quoteNumber: j.quoteNumber }, { $set: j }, { upsert: true });
  }

  // Métrica mongo: findOne por quoteNumber
  const mongoAvg = files.length > 0
    ? await measure(async (i) => {
        const ref = readJSON(files[i % files.length].file)?.quoteNumber;
        await col.findOne({ quoteNumber: ref });
      }, 100)
    : 0;

  await close();
  if (mongod) await mongod.stop();

  const max = Math.max(fileAvg, mongoAvg, 1);
  // Reporte ASCII
  console.log('\n=== Perf Repo Compare (ms/op) ===');
  console.log(`file : ${fileAvg.toFixed(3)} ms ${bar(fileAvg, max)}`);
  console.log(`mongo: ${mongoAvg.toFixed(3)} ms ${bar(mongoAvg, max)}`);
  console.log('================================\n');

  // No fallar si no hay datos; sólo assert fundamentals
  assert.ok(fileAvg >= 0 && mongoAvg >= 0);
});
