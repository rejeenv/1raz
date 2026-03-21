module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.NOWPAYMENTS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing NOWPAYMENTS_API_KEY' });

  // parse body manually if needed
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const { amount = 111, orderId = 'ORD-' + Date.now() } = body || {};

  console.log('Creating payment:', { amount, orderId, apiKeyPrefix: API_KEY.substring(0, 8) });

  try {
    const r = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount:      Number(amount),
        price_currency:    'pln',
        pay_currency:      'ltc',
        order_id:          String(orderId),
        order_description: 'MerryMi Panda X 40K — 1raz',
        ipn_callback_url:  `https://${req.headers['host']}/api/webhook`
      })
    });

    const data = await r.json();
    console.log('NOWPayments response:', r.status, JSON.stringify(data));

    if (!r.ok) {
      return res.status(500).json({ error: 'NOWPayments error', detail: data });
    }

    return res.status(200).json({
      paymentId:   data.payment_id,
      payAddress:  data.pay_address,
      payAmount:   data.pay_amount,
      payCurrency: data.pay_currency,
      status:      data.payment_status
    });

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};
