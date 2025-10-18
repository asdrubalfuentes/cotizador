const fs = require('fs');
const path = require('path');
const { OUTPUT_DIR } = require('./storage');

const LINKS_FILE = path.join(OUTPUT_DIR, 'client_links.json');

function readAll(){
  try {
    if (!fs.existsSync(LINKS_FILE)) return {};
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')) || {};
  } catch { return {}; }
}

function writeAll(links){
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), 'utf8');
}

function normalizeEmail(e){ return String(e||'').trim().toLowerCase(); }
function normalizeName(n){ return String(n||'').trim().toLowerCase(); }
function normalizeTaxId(t){ return String(t||'').trim().toUpperCase(); }

function ensureUser(links, email){
  const key = normalizeEmail(email);
  if (!links[key]) links[key] = { clientEmails: [], clientNames: [], taxIds: [] };
  return key;
}

function getLinks(){ return readAll(); }

function setLinksFor(email, data){
  const links = readAll();
  const key = ensureUser(links, email);
  links[key] = {
    clientEmails: Array.from(new Set((data.clientEmails||[]).map(normalizeEmail))),
    clientNames: Array.from(new Set((data.clientNames||[]).map(normalizeName))),
    taxIds: Array.from(new Set((data.taxIds||[]).map(normalizeTaxId))),
  };
  writeAll(links);
  return links[key];
}

function addLink(email, patch){
  const links = readAll();
  const key = ensureUser(links, email);
  const curr = links[key];
  if (patch.clientEmail) curr.clientEmails.push(normalizeEmail(patch.clientEmail));
  if (patch.clientName) curr.clientNames.push(normalizeName(patch.clientName));
  if (patch.taxId) curr.taxIds.push(normalizeTaxId(patch.taxId));
  curr.clientEmails = Array.from(new Set(curr.clientEmails));
  curr.clientNames = Array.from(new Set(curr.clientNames));
  curr.taxIds = Array.from(new Set(curr.taxIds));
  links[key] = curr;
  writeAll(links);
  return curr;
}

module.exports = { getLinks, setLinksFor, addLink };
