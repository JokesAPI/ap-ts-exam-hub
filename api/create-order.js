export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, plan, user_id } = req.body;

    if (!amount || !user_id) {
      return res.status(400).json({ error: 'Missing amount or user_id' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay not configured' });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: 'order_' + user_id.slice(0, 8) + '_' + Date.now(),
        notes: { user_id, plan },
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      throw new Error(order.error?.description || 'Razorpay order creation failed');
    }

    return res.status(200).json({ order_id: order.id });

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message });
  }
}
