const express = require('express');
const router = express.Router();
const { saveJSON, readJSON } = require('../lib/storage');

const ITEMS_FILE = 'items.json';

router.get('/', (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  res.json(items);
});

router.post('/', (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const item = req.body;
  item.id = String(Date.now());
  items.push(item);
  saveJSON(ITEMS_FILE, items);
  res.json({ ok: true, item });
});

router.put('/:id', (req, res) => {
  const id = req.params.id;
  const items = readJSON(ITEMS_FILE) || [];
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  items[idx] = { ...items[idx], ...req.body };
  saveJSON(ITEMS_FILE, items);
  res.json({ ok: true, item: items[idx] });
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const items = readJSON(ITEMS_FILE) || [];
  const next = items.filter(i => i.id !== id);
  saveJSON(ITEMS_FILE, next);
  res.json({ ok: true });
});

module.exports = router;
