const axios = require('axios');

// WhatsApp provider util with Meta Cloud API and Twilio support
// Configuration via env:
//  - WHATSAPP_PROVIDER = 'meta' | 'twilio'
//  Meta:
//    - META_WABA_TOKEN (Permanent token)
//    - META_PHONE_NUMBER_ID (e.g., 123456789012345)
//  Twilio:
//    - TWILIO_ACCOUNT_SID
//    - TWILIO_AUTH_TOKEN
//    - TWILIO_WHATSAPP_FROM (e.g., 'whatsapp:+14155238886')

function normalizePhone(toPhone) {
  if (!toPhone) return '';
  const s = String(toPhone).trim();
  // Expecting E.164 like +569...; if not, try to add + prefix
  if (!s.startsWith('+') && /^\d+$/.test(s)) return `+${s}`;
  return s;
}

async function sendViaMeta({ toPhone, text }) {
  const token = process.env.META_WABA_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'meta_not_configured' };
  }
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(toPhone),
      type: 'text',
      text: { body: text }
    };
    const res = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 12000
    });
    return { ok: true, provider: 'meta', id: res.data?.messages?.[0]?.id || null };
  } catch (e) {
    const msg = e.response?.data || e.message;
    return { ok: false, error: 'meta_send_failed', details: msg };
  }
}

async function sendViaTwilio({ toPhone, text }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // 'whatsapp:+14155238886'
  if (!sid || !token || !from) {
    return { ok: false, error: 'twilio_not_configured' };
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const params = new URLSearchParams({
      From: from,
      To: `whatsapp:${normalizePhone(toPhone)}`,
      Body: text
    });
    const res = await axios.post(url, params, {
      auth: { username: sid, password: token },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 12000
    });
    return { ok: true, provider: 'twilio', id: res.data?.sid || null };
  } catch (e) {
    const msg = e.response?.data || e.message;
    return { ok: false, error: 'twilio_send_failed', details: msg };
  }
}

async function sendWhatsApp({ toPhone, text }) {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  if (!toPhone || !text) return { ok: false, error: 'missing_params' };
  if (provider === 'meta') return sendViaMeta({ toPhone, text });
  if (provider === 'twilio') return sendViaTwilio({ toPhone, text });
  // No provider configured: return mock ok=false with explanation
  return { ok: false, error: 'provider_not_configured' };
}

module.exports = { sendWhatsApp };
