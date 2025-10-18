const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { createUser, findByEmail, verifyPassword, markLogin, updateUser } = require('../lib/users');
const { parseAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

router.use(parseAuth);

// Self-signup de clientes
router.post('/register', (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const user = createUser({ email, password, name, role: 'cliente' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ ok: true, user, token });
  } catch (e) {
    const code = (e.message === 'email_already_exists' || e.message === 'email_password_required') ? 400 : 500;
    res.status(code).json({ error: e.message });
  }
});

// Login por email/password
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = findByEmail(email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  if (user.status && user.status !== 'active') return res.status(403).json({ error: 'user_inactive' });
  if (!verifyPassword(user, password)) return res.status(401).json({ error: 'invalid_credentials' });
  const publicUser = { id: user.id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(publicUser, JWT_SECRET, { expiresIn: '12h' });
  try { markLogin(user.email); } catch (e) { /* ignore */ }
  res.json({ ok: true, user: publicUser, token });
});

// Perfil actual (si hay token)
router.get('/me', (req, res) => {
  if (!req.user) return res.status(200).json({ ok: true, user: null });
  res.json({ ok: true, user: req.user });
});

// Actualizar perfil propio (nombre y/o password)
router.put('/me', (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const current = findByEmail(req.user.email)
    if (!current) return res.status(404).json({ error: 'not_found' });
    const patch = {}
    if (typeof req.body?.name === 'string') patch.name = req.body.name
    if (typeof req.body?.password === 'string' && req.body.password.trim() !== '') patch.password = req.body.password
    const updated = updateUser(current.id, patch)
    res.json({ ok: true, user: { id: updated.id, email: updated.email, role: updated.role, name: updated.name } })
  } catch (e) {
    res.status(500).json({ error: 'server error' })
  }
})

// TODO: OAuth con Meta (skeleton)
router.get('/meta/oauth/start', (req, res) => {
  // Aquí iría el redirect a Meta OAuth si se habilita
  res.status(501).json({ error: 'not_implemented' });
});

module.exports = router;
