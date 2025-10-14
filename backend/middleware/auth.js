const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const AUTHZ_STRICT = String(process.env.AUTHZ_STRICT || 'false').toLowerCase() === 'true';

function parseAuth(req, _res, next) {
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      req.user = null; return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {
    req.user = null;
  }
  next();
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!AUTHZ_STRICT) return next(); // modo relax por defecto
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    if (!req.user.role || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = { parseAuth, requireRole };
