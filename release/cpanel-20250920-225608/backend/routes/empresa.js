const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { saveJSON, readJSON } = require('../lib/storage');

const EMPRESAS_FILE = 'empresas.json';

// simple admin auth middleware for POST/PUT/DELETE
function requireAdmin(req, res, next){
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if(!token){ return res.status(401).json({ error: 'unauthorized' }); }
  try{
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
    jwt.verify(token, secret);
    next();
  }catch(err){
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// GET /api/empresa - list all companies
router.get('/', (req, res) => {
  const empresas = readJSON(EMPRESAS_FILE) || [];
  res.json(empresas);
});

// GET /api/empresa/:id - get single company
router.get('/:id', (req, res) => {
  const empresas = readJSON(EMPRESAS_FILE) || [];
  const empresa = empresas.find(e => e.id === req.params.id);
  if (!empresa) return res.status(404).json({ error: 'not found' });
  res.json(empresa);
});

// POST /api/empresa - create new company
router.post('/', requireAdmin, (req, res) => {
  const empresas = readJSON(EMPRESAS_FILE) || [];
  const newEmpresa = {
    id: String(Date.now()),
    name: req.body.name || '',
    email: req.body.email || '',
    address: req.body.address || '',
    phone: req.body.phone || '',
    taxId: req.body.taxId || '',
    logo: req.body.logo || '',
    paymentDetails: req.body.paymentDetails || '',
    terms: req.body.terms || '',
    createdAt: new Date().toISOString()
  };
  empresas.push(newEmpresa);
  saveJSON(EMPRESAS_FILE, empresas);
  res.json({ ok: true, empresa: newEmpresa });
});

// PUT /api/empresa/:id - update company
router.put('/:id', requireAdmin, (req, res) => {
  const empresas = readJSON(EMPRESAS_FILE) || [];
  const index = empresas.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'not found' });
  
  empresas[index] = {
    ...empresas[index],
    name: req.body.name || empresas[index].name,
    email: req.body.email || empresas[index].email,
    address: req.body.address || empresas[index].address,
    phone: req.body.phone || empresas[index].phone,
    taxId: req.body.taxId || empresas[index].taxId,
    logo: req.body.logo || empresas[index].logo,
    paymentDetails: req.body.paymentDetails || empresas[index].paymentDetails,
    terms: req.body.terms || empresas[index].terms,
    updatedAt: new Date().toISOString()
  };
  
  saveJSON(EMPRESAS_FILE, empresas);
  res.json({ ok: true, empresa: empresas[index] });
});

// DELETE /api/empresa/:id - delete company
router.delete('/:id', requireAdmin, (req, res) => {
  const empresas = readJSON(EMPRESAS_FILE) || [];
  const filtered = empresas.filter(e => e.id !== req.params.id);
  if (empresas.length === filtered.length) return res.status(404).json({ error: 'not found' });
  
  saveJSON(EMPRESAS_FILE, filtered);
  res.json({ ok: true });
});

module.exports = router;
