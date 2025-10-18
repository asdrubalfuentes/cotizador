#!/usr/bin/env node
const axios = require('axios');
const https = require('https');

const backend = process.argv[2] || 'https://emqx.aysafi.com:8443';
const skip = process.env.SKIP_TLS_VERIFY === '1';
const agent = backend.startsWith('https://') ? new https.Agent({ rejectUnauthorized: !skip }) : undefined;

(async () => {
  try {
    const r = await axios.get(`${backend}/api/rates`, { httpsAgent: agent, timeout: 15000 });
    console.log('GET /api/rates ->', r.status, r.data);
    process.exit(0);
  } catch (e) {
    console.error('GET /api/rates failed:', e.response?.status || '', e.message);
    process.exit(1);
  }
})();
