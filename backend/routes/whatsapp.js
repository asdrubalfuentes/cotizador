const express = require('express');
const router = express.Router();
const { sendWhatsApp } = require('../utils/whatsapp');

// Simple admin protection (reuse admin token if configured)
function requireAdminIfConfigured(req, res, next) {
  const adminConfigured = !!(process.env.ADMIN_PASSWORD);
  if (!adminConfigured) return next();
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
    require('jsonwebtoken').verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

router.post('/send', requireAdminIfConfigured, async (req, res) => {
  try {
    const { toPhone, text } = req.body || {};
    if (!toPhone || !text) return res.status(400).json({ error: 'toPhone_and_text_required' });
    const result = await sendWhatsApp({ toPhone, text });
    if (!result.ok) return res.status(502).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'unexpected_error', details: e.message });
  }
});

module.exports = router;
