#!/usr/bin/env node
const axios = require('axios');
const https = require('https');

const backend = process.argv[2] || 'https://emqx.aysafi.com:8443';
const skip = process.env.SKIP_TLS_VERIFY === '1';
const agent = backend.startsWith('https://') ? new https.Agent({ rejectUnauthorized: !skip }) : undefined;

(async () => {
  try {
    const body = {
      client: 'Test Minimal',
      clientEmail: '',
      items: [{ id: '1', desc: 'Item', qty: 1, discount: 0, price: 1 }],
      currency: 'CLP',
      isRequiredPrepayment: false,
      prepaymentValue: 0,
      total: 1,
      title: 'Prueba mínima'
    };
    const r = await axios.post(`${backend}/api/quotes`, body, { httpsAgent: agent, timeout: 20000, headers: { 'Content-Type': 'application/json' } });
    console.log('POST /api/quotes ->', r.status, r.data);
    process.exit(0);
  } catch (e) {
    console.error('POST /api/quotes failed:', e.response?.status || '', e.message);
    if (e.response?.data) console.error('Body:', e.response.data);
    process.exit(1);
  }
})();
