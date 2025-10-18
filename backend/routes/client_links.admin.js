const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const links = require('../lib/client_links');

router.use(requireRole(['admin']));

// Listar todas las asociaciones
router.get('/', (req, res) => {
  try { res.json({ ok: true, links: links.getLinks() }); }
  catch (e) { res.status(500).json({ error: 'server error' }); }
});

// Reemplazar asociaciones para un usuario (PUT)
router.put('/:email', (req, res) => {
  try {
    const email = req.params.email;
    const data = req.body || {};
    const saved = links.setLinksFor(email, {
      clientEmails: Array.isArray(data.clientEmails) ? data.clientEmails : [],
      clientNames: Array.isArray(data.clientNames) ? data.clientNames : [],
      taxIds: Array.isArray(data.taxIds) ? data.taxIds : [],
    });
    res.json({ ok: true, saved });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

// Agregar vínculo puntual (POST)
router.post('/:email', (req, res) => {
  try {
    const email = req.params.email;
    const patch = req.body || {};
    const saved = links.addLink(email, patch);
    res.json({ ok: true, saved });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

// Eliminar todas las asociaciones de un usuario (DELETE)
router.delete('/:email', (req, res) => {
  try {
    const email = req.params.email;
    const all = links.getLinks();
    const key = String(email||'').toLowerCase();
    const existed = !!all[key];
    if (existed) {
      delete all[key];
      require('fs').writeFileSync(require('path').join(require('../lib/storage').OUTPUT_DIR, 'client_links.json'), JSON.stringify(all, null, 2), 'utf8');
    }
    res.json({ ok: true, existed });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
