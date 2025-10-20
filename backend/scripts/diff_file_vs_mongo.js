#!/usr/bin/env node
/*
  Compara cotizaciones en filesystem (storage) vs MongoDB.
  Uso:
    node backend/scripts/diff_file_vs_mongo.js [--since YYYY-MM-DD] [--limit N] [--uri mongodb://...] [--db nombre]
*/
const crypto = require('node:crypto');
const { listQuotes, readJSON } = require('../lib/storage');
const { connect, getQuotesCollection, close } = require('../lib/db/mongo');

function parseArgs(argv) {
  const args = { since: null, limit: 0, uri: null, db: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = Number(argv[++i] || 0) || 0;
    else if (a === '--since') args.since = new Date(argv[++i]);
    else if (a === '--uri') args.uri = argv[++i];
    else if (a === '--db') args.db = argv[++i];
  }
  return args;
}

function stable(obj) {
  // Elimina campos volátiles y ordena keys para hash estable
  const omit = new Set(['_id']);
  const replacer = (k, v) => (omit.has(k) ? undefined : v);
  return JSON.stringify(obj, Object.keys(obj).sort(), 2, replacer);
}

function hash(obj) {
  return crypto.createHash('sha1').update(stable(obj)).digest('hex');
}

async function diff({ since = null, limit = 0, uri = null, db = null } = {}) {
  try {
    if (uri || db) await connect(uri || process.env.MONGO_URI, db || process.env.MONGO_DB);
    else await connect();
    const col = await getQuotesCollection();

    // Indexar Mongo por quoteNumber
    const mongoMap = new Map();
    const filter = since ? { saved_at: { $gte: since.toISOString() } } : {};
    const mdocs = await col.find(filter).project({ _id: 0 }).toArray();
    for (const d of mdocs) mongoMap.set(String(d.quoteNumber), d);

    const files = listQuotes();
    let processed = 0;
    const onlyFile = [];
    const onlyMongo = [];
    const mismatches = [];

    const seenRefs = new Set();
    for (const f of files) {
      if (limit && processed >= limit) break;
      processed++;
      const j = readJSON(f.file);
      if (!j) continue;
      const ref = String(j.quoteNumber || '').trim();
      seenRefs.add(ref);
      const m = mongoMap.get(ref);
      if (!m) { onlyFile.push(ref); continue; }
      const hf = hash(j);
      const hm = hash(m);
      if (hf !== hm) mismatches.push(ref);
    }

    for (const [ref] of mongoMap) {
      if (!seenRefs.has(ref)) onlyMongo.push(ref);
    }

    return {
      ok: true,
      fileCount: files.length,
      mongoCount: mdocs.length,
      onlyFileCount: onlyFile.length,
      onlyMongoCount: onlyMongo.length,
      mismatchesCount: mismatches.length,
      sample: {
        onlyFile: onlyFile.slice(0, 10),
        onlyMongo: onlyMongo.slice(0, 10),
        mismatches: mismatches.slice(0, 10)
      }
    };
  } finally {
    try { await close(); } catch (e) { console.warn('[diff] close mongo failed', e?.message || e); }
  }
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv);
    const res = await diff(args);
    console.log(JSON.stringify(res, null, 2));
    if (!res.ok) process.exitCode = 1;
  })();
}

module.exports = { diff, parseArgs };
