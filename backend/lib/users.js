const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { OUTPUT_DIR } = require('./storage');

const USERS_FILE = path.join(OUTPUT_DIR, 'users.json');

function readAll() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function findByEmail(email) {
  const users = readAll();
  return users.find(u => u.email?.toLowerCase() === String(email||'').toLowerCase()) || null;
}

function createUser({ email, password, role = 'cliente', name, status = 'active' }) {
  if (!email || !password) throw new Error('email_password_required');
  const existing = findByEmail(email);
  if (existing) throw new Error('email_already_exists');
  const users = readAll();
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const passwordHash = bcrypt.hashSync(String(password), 10);
  const now = new Date().toISOString();
  const user = { id, email, passwordHash, role, name: name || '', status, createdAt: now, updatedAt: now, lastLoginAt: null };
  users.push(user);
  writeAll(users);
  return { id, email, role, name: user.name, status };
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(String(password||''), user.passwordHash || '');
}
function findById(id){
  const users = readAll();
  return users.find(u => u.id === id) || null;
}

function listUsers(){
  return readAll().map((u) => {
    const { passwordHash: _ignored, ...rest } = u;
    return rest;
  });
}

function updateUser(id, patch){
  const users = readAll();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  const u = users[idx];
  if (patch.password) {
    u.passwordHash = bcrypt.hashSync(String(patch.password), 10);
  }
  if (patch.role) u.role = patch.role;
  if (patch.name !== undefined) u.name = patch.name;
  if (patch.status) u.status = patch.status;
  u.updatedAt = new Date().toISOString();
  users[idx] = u;
  writeAll(users);
  const { passwordHash: _ignored, ...rest } = u;
  return rest;
}

function removeUser(id){
  const users = readAll();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  writeAll(filtered);
  return true;
}

function markLogin(email){
  const users = readAll();
  const idx = users.findIndex(u => u.email?.toLowerCase() === String(email||'').toLowerCase());
  if (idx === -1) return;
  users[idx].lastLoginAt = new Date().toISOString();
  writeAll(users);
}

function seedDefaults(){
  try {
    if (!fs.existsSync(USERS_FILE)) writeAll([]);
    const users = readAll();
    if (users.length > 0) return;
    console.log('[users] Seeding default users...');
    createUser({ email: 'admin@local', password: 'admin123', role: 'admin', name: 'Admin', status: 'active' });
    createUser({ email: 'cotizador@local', password: 'cotiza123', role: 'cotizador', name: 'Cotizador', status: 'active' });
    createUser({ email: 'cliente@local', password: 'cliente123', role: 'cliente', name: 'Cliente', status: 'active' });
  } catch (e) {
    console.warn('[users] seed error', e?.message || e);
  }
}

module.exports = { readAll, writeAll, findByEmail, createUser, verifyPassword, findById, listUsers, updateUser, removeUser, markLogin, seedDefaults };
