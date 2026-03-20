module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, orderId, customerEmail } = req.body;
  const API_KEY = process.env.NOWPAYMENTS_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'Missing NOWPAYMENTS_API_KEY' });

  try {
    const r = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount:      amount,
        price_currency:    'pln',
        pay_currency:      'ltc',
        order_id:          orderId,
        order_description: 'MerryMi Panda X 40K — 1raz',
        ipn_callback_url:  `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['host']}/api/webhook`
      })
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('NOWPayments error:', JSON.stringify(data));
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
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
