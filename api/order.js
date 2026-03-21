// api/order.js
// Obsługuje zamówienia — zapisuje prowizje do Upstash, wysyła na Telegram

const PRICE      = 99;
const COMMISSION = 0.10;

async function kv(method, ...args) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/${[method, ...args].map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const d = await r.json();
  return d.result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    flavors, subtotal, delivery, total,
    locker, email, telegram, payMethod,
    pscCode, product, ltcPaymentId, affCode
  } = req.body;

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Config error' });

  // ── Prowizja afiliacyjna ──
  let affLine    = '';
  let commission = 0;
  const code     = affCode?.toUpperCase();

  if (code) {
    const exists = await kv('EXISTS', `aff:${code}`);
    if (exists) {
      commission = Math.round(PRICE * COMMISSION * 100) / 100;
      // zlicz sprzedaż
      await kv('INCRBYFLOAT', `aff:${code}:earned`, commission.toString());
      await kv('INCR', `aff:${code}:sales`);
      const totalEarned = parseFloat(await kv('GET', `aff:${code}:earned`) || '0');
      const totalSales  = parseInt(await kv('GET',  `aff:${code}:sales`)  || '0');

      affLine = `\n🏷 Kod: *${code}* (+${commission.toFixed(2)} zł prowizji)\n📈 Łącznie kod ${code}: ${totalSales} sprzedaży · ${totalEarned.toFixed(2)} zł`;
    } else {
      affLine = `\n🏷 Kod: *${code}* _(nieznany — nie naliczono prowizji)_`;
    }
  }

  const payLine = payMethod === 'ltc'
    ? `💰 Płatność: Litecoin\n🆔 Payment ID: \`${ltcPaymentId || '—'}\``
    : `💳 Płatność: PaySafeCard (kontakt TG)\n🔑 Kod PSC: \`${pscCode || '—'}\``;

  const message = `
🛒 *NOWE ZAMÓWIENIE — 1raz*

📦 ${product || 'MerryMi Panda X 40K'}
🍬 Smaki: *${flavors || '—'}*
📬 Paczkomat: \`${locker || '—'}\`
📧 Email: ${email || '—'}
💬 Telegram: ${telegram || '—'}
${affLine}

━━━━━━━━━━━━━━━
💵 Produkty: ${subtotal || '—'}
🚚 Dostawa: ${delivery || '12 zł'}
💰 *Razem: ${total || '—'}*
━━━━━━━━━━━━━━━

${payLine}

⏰ ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}
  `.trim();

  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })
    });
    const d = await r.json();
    if (!d.ok) return res.status(500).json({ error: 'Telegram error', detail: d });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
};
