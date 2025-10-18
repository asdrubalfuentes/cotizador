const express = require('express');
const router = express.Router();
const { listUsers, createUser, updateUser, removeUser } = require('../lib/users');
const { requireRole } = require('../middleware/auth');

// Proteger todo con rol admin cuando AUTHZ_STRICT=true
router.use(requireRole(['admin']));

router.get('/', (_req, res) => {
  res.json({ users: listUsers() });
});

router.post('/', (req, res) => {
  try {
    const { email, password, name, role, status } = req.body || {};
    const u = createUser({ email, password, name, role, status });
    res.json({ ok: true, user: u });
  } catch (e) {
    const code = (e.message === 'email_already_exists' || e.message === 'email_password_required') ? 400 : 500;
    res.status(code).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const u = updateUser(id, req.body || {});
  if (!u) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, user: u });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const ok = removeUser(id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

module.exports = router;
