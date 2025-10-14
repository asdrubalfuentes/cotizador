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

function createUser({ email, password, role = 'cliente', name }) {
  if (!email || !password) throw new Error('email_password_required');
  const existing = findByEmail(email);
  if (existing) throw new Error('email_already_exists');
  const users = readAll();
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const passwordHash = bcrypt.hashSync(String(password), 10);
  const user = { id, email, passwordHash, role, name: name || '' };
  users.push(user);
  writeAll(users);
  return { id, email, role, name: user.name };
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(String(password||''), user.passwordHash || '');
}

module.exports = { readAll, writeAll, findByEmail, createUser, verifyPassword };
