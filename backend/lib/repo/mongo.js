const { getQuotesCollection } = require('../db/mongo');

// Mantener PDFs/QR en filesystem igual que file adapter
const { OUTPUT_DIR, PDFS_DIR } = require('../storage');

function fileNameFromRef(ref) {
  return `${ref}.json`;
}

async function listQuotes() {
  const col = await getQuotesCollection();
  const docs = await col.find({}, { projection: { quoteNumber: 1 } }).sort({ saved_at: -1 }).toArray();
  return docs.map(d => ({ file: fileNameFromRef(d.quoteNumber) }));
}

async function readJSON(filename) {
  const ref = String(filename).replace(/\.json$/i, '');
  const col = await getQuotesCollection();
  const doc = await col.findOne({ quoteNumber: ref });
  return doc || null;
}

async function saveJSON(filename, obj) {
  const ref = String(filename).replace(/\.json$/i, '');
  const col = await getQuotesCollection();
  const data = { ...obj, quoteNumber: ref };
  await col.updateOne({ quoteNumber: ref }, { $set: data }, { upsert: true });
}

function nextRef(prefix = 'COT') {
  const now = new Date();
  const ref = `${prefix}-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  return ref;
}

module.exports = {
  listQuotes,
  saveJSON,
  readJSON,
  nextRef,
  OUTPUTS_DIR: OUTPUT_DIR,
  PDFS_DIR,
};
