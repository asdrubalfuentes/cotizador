const fs = require('fs');
const path = require('path');

// Unify outputs folder at repo root: project_root/outputs (allow override by env)
const DEFAULT_OUTPUTS_DIR = path.join(__dirname, '..', '..', 'outputs');
const OUTPUTS_DIR = process.env.OUTPUTS_DIR && process.env.OUTPUTS_DIR.trim() !== ''
  ? path.isAbsolute(process.env.OUTPUTS_DIR)
    ? process.env.OUTPUTS_DIR
    : path.join(__dirname, '..', '..', process.env.OUTPUTS_DIR)
  : DEFAULT_OUTPUTS_DIR;
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

function listQuotes() {
  return fs.readdirSync(OUTPUTS_DIR)
    .filter(f => f.endsWith('.json') && f.startsWith('COT-2025'))
    .map(f => ({ file: f, path: path.join(OUTPUTS_DIR, f) }));
}

function saveJSON(filename, obj) {
  const p = path.join(OUTPUTS_DIR, filename);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function readJSON(filename) {
  const p = path.join(OUTPUTS_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function nextRef(prefix = 'COT') {
  // simple next ref based on timestamp
  const now = new Date();
  const ref = `${prefix}-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
  return ref;
}

module.exports = { listQuotes, saveJSON, readJSON, nextRef, OUTPUTS_DIR };
