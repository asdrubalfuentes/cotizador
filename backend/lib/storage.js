const fs = require('fs');
const path = require('path');

// Unificar carpeta de salidas junto a app.js: backend/outputs por defecto
// Prioridad: OUTPUT_DIR (nuevo) > OUTPUTS_DIR (legacy) > backend/outputs
const BACKEND_DIR = path.join(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(BACKEND_DIR, 'outputs');

const raw = (process.env.OUTPUT_DIR && String(process.env.OUTPUT_DIR).trim() !== '')
  ? process.env.OUTPUT_DIR
  : (process.env.OUTPUTS_DIR && String(process.env.OUTPUTS_DIR).trim() !== '')
    ? process.env.OUTPUTS_DIR
    : DEFAULT_OUTPUT_DIR;

// Asegura que sea absoluta; si es relativa, resuélvela respecto a backend/
const OUTPUT_DIR = path.isAbsolute(raw) ? raw : path.resolve(BACKEND_DIR, raw);

// Subcarpetas típicas
const LOGOS_DIR = path.join(OUTPUT_DIR, 'logos');
const PDFS_DIR = path.join(OUTPUT_DIR, 'pdfs');

function ensureDirectories() {
  [OUTPUT_DIR, LOGOS_DIR, PDFS_DIR].forEach((p) => {
    try { fs.mkdirSync(p, { recursive: true }); }
    catch (e) { console.warn(`[storage] No se pudo crear ${p}: ${e.message}`); }
  });
}

// Compatibilidad: exportar OUTPUTS_DIR como alias
const OUTPUTS_DIR = OUTPUT_DIR;
ensureDirectories();

function listQuotes() {
  // Listar archivos de cotización JSON que comiencen con "COT-" de cualquier año
  // Ejemplos válidos: COT-2025-123456.json, COT-2024-000001.json
  const re = /^COT-\d{4}-.*\.json$/i;
  return fs.readdirSync(OUTPUT_DIR)
    .filter(f => re.test(f))
    .map(f => ({ file: f, path: path.join(OUTPUT_DIR, f) }));
}

function saveJSON(filename, obj) {
  const p = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function readJSON(filename) {
  const p = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function nextRef(prefix = 'COT') {
  // simple next ref based on timestamp
  const now = new Date();
  const ref = `${prefix}-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  return ref;
}

module.exports = { listQuotes, saveJSON, readJSON, nextRef, OUTPUTS_DIR, OUTPUT_DIR, LOGOS_DIR, PDFS_DIR, ensureDirectories };
