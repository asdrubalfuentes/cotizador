const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OUTPUTS_DIR } = require('../lib/storage');

const router = express.Router();

// Env flags to control behavior
const RATES_TIMEOUT_MS = Number(process.env.RATES_TIMEOUT_MS || 3500);
const RATES_SOURCE = String(process.env.RATES_SOURCE || 'backend').trim();
const QUOTE_SKIP_RATES = String(process.env.QUOTE_SKIP_RATES || '').trim() === '1';

// GET /api/rates
// Returns latest UF and USD rates from mindicador.cl
// { UF: number, USD: number, source: 'mindicador' | 'disabled' }
router.get('/', async (req, res) => {
  // If rates are globally disabled for quotes, also disable here to be coherent
  if (QUOTE_SKIP_RATES || RATES_SOURCE === 'disabled') {
    return res.json({ UF: 0, USD: 0, source: 'disabled' });
  }
  try {
    const [ufRes, usdRes] = await Promise.all([
      axios.get('https://mindicador.cl/api/uf', { timeout: RATES_TIMEOUT_MS }),
      axios.get('https://mindicador.cl/api/dolar', { timeout: RATES_TIMEOUT_MS }),
    ]);
    const UF = Number(ufRes?.data?.serie?.[0]?.valor ?? 0) || 0;
    const USD = Number(usdRes?.data?.serie?.[0]?.valor ?? 0) || 0;
    // Cachear último valor exitoso
    try {
      const cache = { UF, USD, source: 'mindicador', cachedAt: new Date().toISOString() };
      fs.writeFileSync(path.join(OUTPUTS_DIR, 'rates.cache.json'), JSON.stringify(cache, null, 2), 'utf8');
    } catch (_) { /* ignore cache errors */ }
    res.json({ UF, USD, source: 'mindicador' });
  } catch (e) {
    console.error('GET /api/rates error:', e?.message || e);
    // Intentar fallback a caché local
    try {
      const p = path.join(OUTPUTS_DIR, 'rates.cache.json');
      if (fs.existsSync(p)) {
        const cached = JSON.parse(fs.readFileSync(p, 'utf8'));
        return res.json({ UF: Number(cached.UF)||0, USD: Number(cached.USD)||0, source: 'cached' });
      }
    } catch (_) { /* ignore cache read errors */ }
    // Degradar con 200 para no romper la UI
    res.json({ UF: 0, USD: 0, source: 'unavailable' });
  }
});

module.exports = router;
