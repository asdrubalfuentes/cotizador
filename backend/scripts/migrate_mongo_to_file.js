#!/usr/bin/env node
/*
  Migra cotizaciones desde MongoDB a archivos JSON (filesystem).

  Uso:
    node backend/scripts/migrate_mongo_to_file.js [--dry-run] [--limit N] [--since YYYY-MM-DD] [--memory] [--uri mongodb://...] [--db nombre] [--dest ruta]

  Variables:
    - OUTPUT_DIR           Directorio destino por defecto (si no se pasa --dest)
    - MONGO_URI / MONGO_DB Conexión a Mongo en modo normal
*/

const fs = require('node:fs');
const path = require('node:path');
const { connect, getQuotesCollection, close } = require('../lib/db/mongo');
const { OUTPUT_DIR } = require('../lib/storage');

function parseArgs(argv) {
  const args = { dryRun: false, limit: 0, since: null, memory: false, uri: null, db: null, dest: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--memory') args.memory = true;
    else if (a === '--limit') { args.limit = Number(argv[++i] || 0) || 0; }
    else if (a === '--since') { args.since = new Date(argv[++i]); }
    else if (a === '--uri') { args.uri = argv[++i]; }
    else if (a === '--db') { args.db = argv[++i]; }
    else if (a === '--dest') { args.dest = argv[++i]; }
  }
  return args;
}

async function migrateBack({ dryRun = false, limit = 0, since = null, memory = false, uri = null, db = null, dest = null } = {}) {
  let mongod = null;
  try {
    const destDir = dest || OUTPUT_DIR;
    if (!dryRun) fs.mkdirSync(destDir, { recursive: true });

    if (memory) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      const uriMem = mongod.getUri();
      await connect(uriMem, db || process.env.MONGO_DB || 'cotizador_migrate');
    } else {
      if (uri || db) await connect(uri || process.env.MONGO_URI, db || process.env.MONGO_DB);
      else await connect();
    }

    const col = await getQuotesCollection();
    const filter = since ? { saved_at: { $gte: since.toISOString() } } : {};
    const cursor = col.find(filter).sort({ saved_at: -1 });

    let processed = 0, written = 0, skipped = 0, errors = 0;
    const details = [];
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (limit && processed >= limit) break;
      processed++;
      try {
        const ref = String(doc.quoteNumber || '').trim();
        if (!ref) { skipped++; details.push({ reason: 'no_ref', _id: String(doc._id) }); continue; }
        const filename = path.join(destDir, `${ref}.json`);
        if (dryRun) { written++; continue; }
        fs.writeFileSync(filename, JSON.stringify(doc, null, 2), 'utf8');
        written++;
      } catch (e) {
        errors++; details.push({ error: e?.message || String(e), ref: doc.quoteNumber });
      }
    }

    return { ok: true, processed, written, skipped, errors };
  } finally {
    try { await close(); } catch (e) { console.warn('[migrate-back] close mongo failed', e?.message || e); }
    if (mongod) { try { await mongod.stop(); } catch (e) { console.warn('[migrate-back] stop memory mongo failed', e?.message || e); } }
  }
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv);
    const res = await migrateBack(args);
    console.log(JSON.stringify(res, null, 2));
    if (!res.ok || res.errors > 0) process.exitCode = 1;
  })();
}

module.exports = { migrateBack, parseArgs };
