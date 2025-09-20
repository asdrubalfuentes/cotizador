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

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan(process.env.MORGAN_FORMAT || 'dev'));

const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const { OUTPUTS_DIR } = require('./lib/storage');
const upload = multer({
  dest: path.join(OUTPUTS_DIR, 'logos'),
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
app.use('/outputs', express.static(OUTPUTS_DIR));

// File upload endpoint for company logos
app.post('/api/upload/logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const originalName = req.file.originalname;
  const extension = path.extname(originalName);
  const newName = `logo_${Date.now()}${extension}`;
  const newPath = path.join(OUTPUTS_DIR, 'logos', newName);
  
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

app.listen(PORT, () => {
  console.log(`Cotizador backend running on port ${PORT}`);
});
