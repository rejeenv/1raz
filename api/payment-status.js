// api/payment-status.js
// Sprawdza status płatności NOWPayments
// Env: NOWPAYMENTS_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing payment id' });

  const API_KEY = process.env.NOWPAYMENTS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing API key' });

  try {
    const r = await fetch(`https://api.nowpayments.io/v1/payment/${id}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'NOWPayments error', detail: data });

    return res.status(200).json({
      status:      data.payment_status,
      payAmount:   data.pay_amount,
      actuallyPaid: data.actually_paid,
      payAddress:  data.pay_address
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
