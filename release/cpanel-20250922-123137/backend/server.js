const { app } = require('./app');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// HTTPS configuration
// Enable HTTPS if:
// - HTTPS=true (or HTTPS_ENABLE=true), or
// - All default cert files exist at /etc/ssl/emqx/
const HTTPS_ENABLED = (process.env.HTTPS === 'true') || (process.env.HTTPS_ENABLE === 'true');
const DEFAULT_CERT_DIR = '/etc/ssl/emqx';
const CERT_FILE = process.env.TLS_CERT_FILE || path.join(DEFAULT_CERT_DIR, 'emqx.crt');
const KEY_FILE = process.env.TLS_KEY_FILE || path.join(DEFAULT_CERT_DIR, 'emqx_key.rsa');
const CA_FILE = process.env.TLS_CA_FILE || path.join(DEFAULT_CERT_DIR, 'emqx.ca-bundle.crt');

function haveDefaultCerts() {
  try {
    return fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE) && fs.existsSync(CA_FILE);
  } catch (_) {
    return false;
  }
}

const shouldUseHttps = HTTPS_ENABLED || haveDefaultCerts();

if (shouldUseHttps) {
  const HTTPS_PORT = Number(process.env.HTTPS_PORT || process.env.PORT || 8443);
  try {
    const options = {
      cert: fs.readFileSync(CERT_FILE),
      key: fs.readFileSync(KEY_FILE),
      ca: fs.readFileSync(CA_FILE),
      // requestCert: false, // no mTLS by default
      // rejectUnauthorized: true,
    };
    https.createServer(options, app).listen(HTTPS_PORT, () => {
      console.log(`[HTTPS] Cotizador backend running on port ${HTTPS_PORT}`);
      console.log(`[HTTPS] cert: ${CERT_FILE}`);
      console.log(`[HTTPS] key : ${KEY_FILE}`);
      console.log(`[HTTPS] ca  : ${CA_FILE}`);
    });
  } catch (err) {
    console.error('[HTTPS] Failed to start HTTPS server:', err && err.message ? err.message : err);
    const FALLBACK_PORT = Number(process.env.PORT || 5000);
    http.createServer(app).listen(FALLBACK_PORT, () => {
      console.warn(`[HTTP] Fallback to HTTP on port ${FALLBACK_PORT}. Check certificate files/permissions.`);
    });
  }
} else {
  const PORT = Number(process.env.PORT || 5000);
  http.createServer(app).listen(PORT, () => {
    console.log(`[HTTP] Cotizador backend running on port ${PORT}`);
  });
}
