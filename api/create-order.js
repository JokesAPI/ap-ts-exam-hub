import { resolvePlan, CURRENCY } from './_plans.js';

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
    // SECURITY: the browser's `amount` is IGNORED. It is not read at all.
    // The amount is derived server-side from the plan id, so a crafted request
    // cannot buy a subscription for Re.1.
    const { plan, user_id } = req.body || {};

    if (!plan || !user_id) {
      return res.status(400).json({ error: 'Missing plan or user_id' });
    }

    const planConfig = resolvePlan(plan);
    if (!planConfig) {
      console.error('create-order: rejected unknown/disabled plan:', plan);
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const amount = planConfig.amountPaise;   // server-side, authoritative

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
        amount,                 // server-derived (paise), never from the browser
        currency: CURRENCY,
        receipt: 'order_' + user_id.slice(0, 8) + '_' + Date.now(),
        notes: { user_id, plan },
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      throw new Error(order.error?.description || 'Razorpay order creation failed');
    }

    // Return the SERVER-derived amount so the checkout widget cannot be opened
    // with a price the browser picked.
    return res.status(200).json({
      order_id: order.id,
      amount:   order.amount,     // paise, as accepted by Razorpay
      currency: order.currency,
    });

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message });
  }
}
