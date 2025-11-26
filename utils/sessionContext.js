const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const sessionsFile = path.join(dataDir, 'sessions.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadSessions() {
  try {
    ensureDataDir();
    if (!fs.existsSync(sessionsFile)) {
      fs.writeFileSync(sessionsFile, JSON.stringify({}), 'utf8');
      return {};
    }
    const raw = fs.readFileSync(sessionsFile, 'utf8');
    return raw && raw.trim() ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[sessionContext] loadSessions failed, falling back to empty store', e && e.message ? e.message : e);
    return {};
  }
}

function saveSessions(obj) {
  try {
    ensureDataDir();
    fs.writeFileSync(sessionsFile, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('[sessionContext] saveSessions failed:', e && e.message ? e.message : e);
  }
}

// in-memory cache to reduce file IO
let sessionsCache = loadSessions();

function normalizeKey(phone) {
  return String(phone || '').trim();
}

function getUserName(phone) {
  const key = normalizeKey(phone);
  return sessionsCache[key] && sessionsCache[key].name ? sessionsCache[key].name : null;
}

function setUserName(phone, name) {
  const key = normalizeKey(phone);
  if (!key) return;
  sessionsCache[key] = sessionsCache[key] || {};
  sessionsCache[key].name = String(name || '').trim();
  saveSessions(sessionsCache);
}

function clearUserName(phone) {
  const key = normalizeKey(phone);
  if (!key) return;
  if (sessionsCache[key]) {
    delete sessionsCache[key].name;
    saveSessions(sessionsCache);
  }
}

function getAllSessions() {
  return sessionsCache;
}

module.exports = { getUserName, setUserName, clearUserName, getAllSessions };
