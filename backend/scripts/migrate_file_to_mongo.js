#!/usr/bin/env node
/*
  Migra cotizaciones desde archivos JSON (filesystem) a MongoDB.

  Uso:
    node backend/scripts/migrate_file_to_mongo.js [--dry-run] [--limit N] [--since YYYY-MM-DD] [--memory]

  Variables:
    - OUTPUT_DIR           Directorio de archivos (por defecto detectado por storage.js)
    - MONGO_URI            URI de Mongo (ej.: mongodb://127.0.0.1:27017)
    - MONGO_DB             Nombre de DB (ej.: cotizador)

  Flags:
    --dry-run              No escribe en Mongo; sólo muestra resumen
    --limit N              Máximo de documentos a migrar
    --since YYYY-MM-DD     Sólo migrar archivos con saved_at/created_at >= fecha
    --memory               Levanta Mongo en memoria (mongodb-memory-server) para pruebas locales
*/

const { listQuotes, readJSON } = require('../lib/storage');
const { connect, getQuotesCollection, close } = require('../lib/db/mongo');

function parseArgs(argv) {
  const args = { dryRun: false, limit: 0, since: null, memory: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--memory') args.memory = true;
    else if (a === '--limit') { args.limit = Number(argv[++i] || 0) || 0; }
    else if (a === '--since') { args.since = new Date(argv[++i]); }
  }
  return args;
}

async function migrate({ dryRun = false, limit = 0, since = null, memory = false } = {}) {
  let mongod = null;
  try {
    if (memory) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await connect(uri, process.env.MONGO_DB || 'cotizador_migrate');
    } else {
      await connect();
    }
    const col = await getQuotesCollection();

    const files = listQuotes();
    let processed = 0; let migrated = 0; let skipped = 0; let errors = 0;
    const details = [];

    for (const f of files) {
      if (limit && processed >= limit) break;
      processed++;
      try {
        const j = readJSON(f.file);
        if (!j) { skipped++; details.push({ file: f.file, reason: 'empty' }); continue; }
        // filtro por fecha si aplica
        if (since) {
          const saved = j.saved_at || j.savedAt || j.created_at || j.createdAt;
          if (saved && new Date(saved) < since) { skipped++; details.push({ file: f.file, reason: 'since' }); continue; }
        }
        const ref = (j.quoteNumber || String(f.file).replace(/\.json$/i, '')).trim();
        j.quoteNumber = ref;
        if (dryRun) { migrated++; continue; }
        await col.updateOne({ quoteNumber: ref }, { $set: j }, { upsert: true });
        migrated++;
      } catch (e) {
        errors++; details.push({ file: f.file, error: e?.message || String(e) });
      }
    }

    return { ok: true, processed, migrated, skipped, errors, totalFiles: files.length, details };
  } finally {
    try { await close(); } catch (e) { console.warn('[migrate] close mongo failed', e?.message || e); }
    if (mongod) { try { await mongod.stop(); } catch (e) { console.warn('[migrate] stop memory mongo failed', e?.message || e); } }
  }
}

// Ejecutar si se llama desde CLI
if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv);
    const res = await migrate(args);
    console.log(JSON.stringify(res, null, 2));
    if (!res.ok || res.errors > 0) process.exitCode = 1;
  })();
}

module.exports = { migrate, parseArgs };
