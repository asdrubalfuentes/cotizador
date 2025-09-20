require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const { transporter } = require('../utils/email');

(async () => {
  try {
    console.log('Verificando conexión SMTP...');
    const ok = await transporter.verify();
    console.log('SMTP verify:', ok);
    process.exit(0);
  } catch (e) {
    console.error('SMTP verify error:', e && e.message, e && e.code);
    if (e && e.response) console.error('Response:', e.response);
    process.exit(1);
  }
})();
