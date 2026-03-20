export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { flavors, subtotal, delivery, total, locker, email, telegram, payMethod, pscCode, product } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Config error' });

  const payLine = payMethod === 'ltc'
    ? `💰 Płatność: Litecoin`
    : `💳 Płatność: PaySafeCard\n🔑 Kod PSC: \`${pscCode}\``;

  const message = `
🛒 *NOWE ZAMÓWIENIE — 1raz*

📦 Produkt: ${product || 'MerryMi Panda X 40K'}
🍬 Smaki: *${flavors || '—'}*
📬 Paczkomat: \`${locker || '—'}\`
📧 Email: ${email || '—'}
💬 Telegram: ${telegram || '—'}

💵 Produkty: ${subtotal || '—'}
🚚 Dostawa: ${delivery || '12 zł'}
💰 *Razem: ${total || '—'}*

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
}
