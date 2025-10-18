const fs = require('fs');
const path = require('path');
const { OUTPUT_DIR, ensureDirectories } = require('./storage');

// Ensure base directories exist
ensureDirectories();
const LOGS_DIR = path.join(OUTPUT_DIR, 'logs');
try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch (_) { /* ignore */ }

// In-memory subscribers for broadcasting (WS layer will hook in)
const subs = new Set();

function addSubscriber(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function yyyymmdd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function logfilePath(dayStr = yyyymmdd()) {
  return path.join(LOGS_DIR, `livelog-${dayStr}.ndjson`);
}

function writeLine(obj) {
  try {
    const line = JSON.stringify(obj) + '\n';
    fs.appendFileSync(logfilePath(), line, 'utf8');
  } catch (e) {
    // last resort: swallow
  }
}

function emit(event) {
  for (const fn of subs) {
    try { fn(event); } catch (_) { /* ignore */ }
  }
}

function log(level, type, data) {
  const evt = {
    ts: new Date().toISOString(),
    level,
    type,
    ...data,
  };
  writeLine(evt);
  emit(evt);
}

// Morgan writable stream adapter
const morganStream = {
  write: (message) => {
    const msg = String(message || '').trim();
    const clean = stripAnsi(msg);
    const http = parseHttpFromMorgan(clean);
    log('info', 'request', http ? { msg: clean, http } : { msg: clean });
  }
};

function wrapConsole(enable = true) {
  if (!enable) return;
  const orig = {
    log: console.log.bind(console),
    info: console.info ? console.info.bind(console) : console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  console.log = (...args) => { try { log('info', 'console', { args }); } catch (e) { /* noop */ } orig.log(...args); };
  console.info = (...args) => { try { log('info', 'console', { args }); } catch (e) { /* noop */ } orig.info(...args); };
  console.warn = (...args) => { try { log('warn', 'console', { args }); } catch (e) { /* noop */ } orig.warn(...args); };
  console.error = (...args) => { try { log('error', 'console', { args }); } catch (e) { /* noop */ } orig.error(...args); };
}

function listLogFiles() {
  try {
    return fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('livelog-') && f.endsWith('.ndjson'))
      // devolver primero los más recientes
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function readLogFile(dayStr) {
  const p = logfilePath(dayStr);
  if (!fs.existsSync(p)) return null;
  return fs.createReadStream(p);
}

function deleteLogFile(dayStr) {
  const p = logfilePath(dayStr);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

module.exports = {
  addSubscriber,
  log,
  morganStream,
  wrapConsole,
  listLogFiles,
  readLogFile,
  deleteLogFile,
  logfilePath,
  LOGS_DIR,
};

// Optional retention: delete files older than N days at load time
function pruneOldLogs(days) {
  const keepDays = Number(days);
  if (!Number.isFinite(keepDays) || keepDays <= 0) return;
  const now = Date.now();
  for (const f of listLogFiles()) {
    const m = f.match(/livelog-(\d{8})/);
    if (!m) continue;
    const day = m[1];
    const y = Number(day.slice(0,4));
    const mo = Number(day.slice(4,6));
    const d = Number(day.slice(6,8));
    const fileTime = new Date(Date.UTC(y, mo - 1, d)).getTime();
    const ageDays = (now - fileTime) / (24*3600*1000);
    if (ageDays > keepDays) {
      try { fs.unlinkSync(path.join(LOGS_DIR, f)); } catch { /* ignore */ }
    }
  }
}

const RETENTION_ENV = process.env.LIVELLOG_RETENTION_DAYS || process.env.LIVELOG_RETENTION_DAYS || '7';
pruneOldLogs(Number(RETENTION_ENV));

// ------- helpers -------
function stripAnsi(str) {
  try {
    // Construir patrón en runtime para evitar control chars en el código fuente
    const ESC = String.fromCharCode(27);   // \x1b
    const CSI = String.fromCharCode(155);  // \x9b
    const pattern = new RegExp('[' + ESC + CSI + ']\\[[0-9;]*m', 'g');
    return String(str).replace(pattern, '');
  } catch { return String(str || ''); }
}

// Intenta extraer METHOD, URL, STATUS, TIME(ms), LENGTH de formatos típicos de morgan
function parseHttpFromMorgan(s) {
  try {
    // ej dev: "GET /api/rates 304 605.009 ms - -"
    let m = s.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)\s+(\d{3})\s+([\d.]+)\s+ms\s+-\s+(-|\d+)/i);
    if (m) {
      return {
        method: m[1], url: m[2], status: Number(m[3]), responseTimeMs: Number(m[4]), length: m[5] === '-' ? null : Number(m[5])
      };
    }
    // ej default: "[2025-10-16T..] GET / 200 41 - 1.006 ms" u otras variantes
    m = s.match(/\]\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)\s+(\d{3})\s+(\d+|-)\s+-\s+([\d.]+)\s+ms/i);
    if (m) {
      return {
        method: m[1], url: m[2], status: Number(m[3]), length: m[4] === '-' ? null : Number(m[4]), responseTimeMs: Number(m[5])
      };
    }
    return null;
  } catch { return null; }
}
