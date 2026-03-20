// api/webhook.js
// Odbiera IPN od NOWPayments i wysyła powiadomienie na Telegram
// Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  const { payment_id, payment_status, order_id, pay_amount, pay_currency, price_amount, price_currency, actually_paid } = req.body;

  // Only notify on meaningful status changes
  const notifyStatuses = ['finished', 'confirmed', 'partially_paid', 'failed', 'expired'];
  if (!notifyStatuses.includes(payment_status)) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const statusEmoji = {
    finished:       '✅',
    confirmed:      '✅',
    partially_paid: '⚠️',
    failed:         '❌',
    expired:        '🕐'
  }[payment_status] || '🔔';

  const message = `
${statusEmoji} *PŁATNOŚĆ ${payment_status.toUpperCase()}*

🆔 Order ID: \`${order_id || '—'}\`
💳 Payment ID: \`${payment_id || '—'}\`
💰 Kwota: ${actually_paid || pay_amount} ${pay_currency?.toUpperCase()}
💵 Wartość: ${price_amount} ${price_currency?.toUpperCase()}
📊 Status: *${payment_status}*

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
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
