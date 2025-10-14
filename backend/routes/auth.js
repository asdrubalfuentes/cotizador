const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { createUser, findByEmail, verifyPassword } = require('../lib/users');
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
  if (!verifyPassword(user, password)) return res.status(401).json({ error: 'invalid_credentials' });
  const publicUser = { id: user.id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(publicUser, JWT_SECRET, { expiresIn: '12h' });
  res.json({ ok: true, user: publicUser, token });
});

// Perfil actual (si hay token)
router.get('/me', (req, res) => {
  if (!req.user) return res.status(200).json({ ok: true, user: null });
  res.json({ ok: true, user: req.user });
});

// TODO: OAuth con Meta (skeleton)
router.get('/meta/oauth/start', (req, res) => {
  // Aquí iría el redirect a Meta OAuth si se habilita
  res.status(501).json({ error: 'not_implemented' });
});

module.exports = router;
