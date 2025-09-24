require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const multer = require('multer');

const empresaRouter = require('./routes/empresa');
const itemsRouter = require('./routes/items');
const quotesRouter = require('./routes/quotes');
const { addClient } = require('./lib/events');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan(process.env.MORGAN_FORMAT || 'dev'));

// Configure multer for file uploads
const { OUTPUT_DIR, LOGOS_DIR, ensureDirectories } = require('./lib/storage');
ensureDirectories();
const upload = multer({
  dest: LOGOS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// API routes
app.use('/api/empresa', empresaRouter);
app.use('/api/items', itemsRouter);
app.use('/api/quotes', quotesRouter);

// Runtime frontend config (modifiable via env without rebuilding frontend)
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  const cfg = {
    API_BASE: process.env.PUBLIC_API_BASE || '',
    FRONTEND_URL: process.env.FRONTEND_URL || '',
  };
  const body = `window.__APP_CONFIG__ = ${JSON.stringify(cfg)};`;
  res.send(body);
});

// Optional: JSON view of runtime config (for diagnostics)
app.get('/api/config', (req, res) => {
  // Very lightweight protection: if ADMIN_PASSWORD is set, require a bearer admin token
  const adminConfigured = !!(process.env.ADMIN_PASSWORD);
  if (adminConfigured) {
    try {
      const auth = req.headers['authorization'] || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'unauthorized' });
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
      require('jsonwebtoken').verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  res.json({
    API_BASE: process.env.PUBLIC_API_BASE || '',
    FRONTEND_URL: process.env.FRONTEND_URL || '',
  });
});

// Server-Sent Events for live updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  // Instruct client reconnection delay (ms) if the connection drops
  res.write('retry: 4000\n\n');
  // Initial ping
  res.write(`event: ping\ndata: {"ok":true}\n\n`);
  const remove = addClient(res);
  // Periodic ping to keep connection alive through proxies
  const pingId = setInterval(() => {
    try { res.write(`event: ping\ndata: {"t":${Date.now()}}\n\n`); } catch (_) { /* ignore */ }
  }, 15000);
  req.on('close', () => {
    try { clearInterval(pingId); } catch (e) { console.warn('SSE clearInterval failed', e?.message || e) }
    try { remove(); } catch (e) { console.warn('SSE remove client failed', e?.message || e) }
    try { res.end(); } catch (_) { /* noop */ }
  });
});

// Admin login route (simple password -> JWT)
app.post('/api/admin/login', (req, res) => {
  const pass = (req.body && req.body.password) || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return res.status(500).json({ error: 'admin_not_configured' });
  if (pass !== expected) return res.status(401).json({ error: 'invalid_credentials' });
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
  const token = require('jsonwebtoken').sign({ role: 'admin' }, jwtSecret, { expiresIn: '8h' });
  res.json({ ok: true, token });
});

// Serve outputs (read-only) from unified directory
app.use('/outputs', express.static(OUTPUT_DIR));

// File upload endpoint for company logos
app.post('/api/upload/logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const originalName = req.file.originalname;
  const extension = path.extname(originalName);
  const newName = `logo_${Date.now()}${extension}`;
  const newPath = path.join(LOGOS_DIR, newName);
  fs.rename(req.file.path, newPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save file' });
    }
    res.json({ ok: true, filename: newName });
  });
});

// Simple endpoint to receive frontend console logs during development
app.post('/api/logs', (req, res) => {
  const level = (req.query.level || 'log').toLowerCase();
  const payload = req.body;
  const args = Array.isArray(payload && payload.args) ? payload.args : [payload];
  const tag = `[frontend:${level}]`;
  try {
    switch (level) {
      case 'error':
        console.error(tag, ...args);
        break;
      case 'warn':
        console.warn(tag, ...args);
        break;
      case 'info':
        console.info(tag, ...args);
        break;
      default:
        console.log(tag, ...args);
    }
  } catch (e) {
    console.log('[frontend]', payload);
  }
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Cotizador backend' });
});

// Serve frontend static build (if present) and SPA fallback
const distPath = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/outputs')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

module.exports = { app };
