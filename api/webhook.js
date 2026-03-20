const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
  const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID    = process.env.TELEGRAM_CHAT_ID;

  // verify signature
  if (IPN_SECRET) {
    const sig  = req.headers['x-nowpayments-sig'];
    if (sig) {
      const sorted = sortedJson(req.body);
      const hmac   = crypto.createHmac('sha512', IPN_SECRET).update(sorted).digest('hex');
      if (hmac !== sig) return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const { payment_id, payment_status, order_id, pay_amount, pay_currency, price_amount, price_currency, actually_paid } = req.body;

  const notifyStatuses = ['finished', 'confirmed', 'partially_paid', 'failed', 'expired'];
  if (!notifyStatuses.includes(payment_status)) return res.status(200).json({ ok: true, skipped: true });

  const emoji = { finished:'✅', confirmed:'✅', partially_paid:'⚠️', failed:'❌', expired:'🕐' }[payment_status] || '🔔';

  const message = `
${emoji} *PŁATNOŚĆ ${payment_status.toUpperCase()}*

🆔 Order: \`${order_id || '—'}\`
💳 Payment ID: \`${payment_id || '—'}\`
💰 Zapłacono: ${actually_paid || pay_amount} ${(pay_currency||'').toUpperCase()}
💵 Wartość: ${price_amount} ${(price_currency||'').toUpperCase()}

⏰ ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}
  `.trim();

  try {
    if (BOT_TOKEN && CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
};

function sortedJson(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(sortedJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + sortedJson(obj[k])).join(',') + '}';
}
