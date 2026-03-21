// api/affiliate.js
// Obsługuje komendy Telegram bota: /stats, /kody, /dodaj_kod
// Env: UPSTASH_URL, UPSTASH_TOKEN, TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID

const COMMISSION = 0.10; // 10%

async function kv(method, ...args) {
  const url  = process.env.UPSTASH_URL;
  const token = process.env.UPSTASH_TOKEN;
  const r = await fetch(`${url}/${[method, ...args].map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const d = await r.json();
  return d.result;
}

async function sendTg(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const msg     = req.body?.message;
  if (!msg) return res.status(200).json({ ok: true });

  const chatId  = msg.chat?.id;
  const text    = msg.text?.trim() || '';
  const adminId = process.env.ADMIN_CHAT_ID;
  const isAdmin = String(chatId) === String(adminId);

  // ── /stats ── każdy może sprawdzić swój kod
  if (text.startsWith('/stats')) {
    const parts = text.split(' ');
    const code  = parts[1]?.toUpperCase();

    if (!code) {
      await sendTg(chatId, '📊 Użycie: `/stats KOD`\nNp. `/stats BUBKA`');
      return res.status(200).json({ ok: true });
    }

    const exists = await kv('EXISTS', `aff:${code}`);
    if (!exists) {
      await sendTg(chatId, `❌ Kod *${code}* nie istnieje.`);
      return res.status(200).json({ ok: true });
    }

    const earned = parseFloat(await kv('GET', `aff:${code}:earned`) || '0');
    const sales  = parseInt(await kv('GET', `aff:${code}:sales`)  || '0');

    await sendTg(chatId,
      `📊 *Statystyki kodu ${code}*\n\n` +
      `🛒 Sprzedaży: *${sales}*\n` +
      `💰 Zarobki: *${earned.toFixed(2)} zł*\n\n` +
      `_Prowizja: 10% z ceny produktu_`
    );
    return res.status(200).json({ ok: true });
  }

  // ── /kody — tylko admin ──
  if (text === '/kody') {
    if (!isAdmin) {
      await sendTg(chatId, '⛔ Brak dostępu.');
      return res.status(200).json({ ok: true });
    }

    const keys = await kv('KEYS', 'aff:*:earned');
    if (!keys || keys.length === 0) {
      await sendTg(chatId, '📋 Brak aktywnych kodów.');
      return res.status(200).json({ ok: true });
    }

    const codes = keys.map(k => k.replace('aff:', '').replace(':earned', ''));
    let msg2 = '📋 *Aktywne kody afiliacyjne:*\n\n';
    for (const code of codes) {
      const earned = parseFloat(await kv('GET', `aff:${code}:earned`) || '0');
      const sales  = parseInt(await kv('GET', `aff:${code}:sales`)  || '0');
      msg2 += `• *${code}* — ${sales} sprzedaży — ${earned.toFixed(2)} zł\n`;
    }
    await sendTg(chatId, msg2);
    return res.status(200).json({ ok: true });
  }

  // ── /dodaj_kod — tylko admin ──
  if (text.startsWith('/dodaj_kod')) {
    if (!isAdmin) {
      await sendTg(chatId, '⛔ Brak dostępu.');
      return res.status(200).json({ ok: true });
    }

    const parts = text.split(' ');
    const code  = parts[1]?.toUpperCase();
    if (!code) {
      await sendTg(chatId, '➕ Użycie: `/dodaj_kod KOD`\nNp. `/dodaj_kod BUBKA`');
      return res.status(200).json({ ok: true });
    }

    const exists = await kv('EXISTS', `aff:${code}`);
    if (exists) {
      await sendTg(chatId, `⚠️ Kod *${code}* już istnieje.`);
      return res.status(200).json({ ok: true });
    }

    await kv('SET', `aff:${code}`, '1');
    await kv('SET', `aff:${code}:earned`, '0');
    await kv('SET', `aff:${code}:sales`,  '0');

    await sendTg(chatId, `✅ Kod *${code}* został dodany.\nProwizja: 10% z każdej sprzedaży.`);
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
};
