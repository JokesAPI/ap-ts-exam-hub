import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_id,
      plan,
    } = req.body;

    // ── 1. Validate required fields ──────────────────────────────────────────
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !user_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // ── 2. Verify Razorpay signature (SERVER SIDE ONLY) ──────────────────────
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpaySecret) {
      console.error('RAZORPAY_KEY_SECRET not set');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(body)
      .digest('hex');

    // ── 3. Compare signatures ──────────────────────────────────────────────────
    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch - possible fraud attempt');
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    // ── 4. Signature valid -- update database with SERVICE ROLE key ────────────
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date();
    const expiresAt = new Date(now);
    if (plan === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_pro: true,
        pro_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return res.status(500).json({ success: false, error: 'Failed to activate Pro' });
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan,
        amount: plan === 'yearly' ? 999 : 199,
        status: 'success',
        created_at: now.toISOString(),
      });

    if (paymentError) {
      console.error('Payment record error:', paymentError); // non-fatal
    }

    return res.status(200).json({ success: true, expires_at: expiresAt.toISOString() });

  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
