import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { resolvePlan, CURRENCY } from './_plans.js';

const isNonEmptyString = v => typeof v === 'string' && v.trim().length > 0;
const UNIQUE_VIOLATION = '23505'; // payments has UNIQUE(razorpay_payment_id)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
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
    } = req.body || {};

    // ── 1. Validate inputs ───────────────────────────────────────────────────
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, plan].every(isNonEmptyString)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Reject unknown or currently-disabled plans (e.g. 'yearly' during the test).
    // The amount is NEVER taken from the browser.
    const planConfig = resolvePlan(plan);
    if (!planConfig) {
      console.error('Rejected unknown/disabled plan:', plan);
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    // ── 2. Razorpay HMAC signature (server-side, unchanged) ──────────────────
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

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch - possible fraud attempt');
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    // ── 3. Verify the REAL payment with Razorpay (authoritative) ────────────
    // The signature only proves the payload came from Razorpay's checkout. It does
    // NOT prove what was actually captured. Without this step a crafted request
    // could pay Re.1 (or nothing) and still be granted Pro. We therefore ask
    // Razorpay directly what it captured, and require an exact match.
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      console.error('RAZORPAY_KEY_ID not set');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const rzpAuth = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString('base64');
    let payment;
    try {
      const rzpRes = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
        { headers: { Authorization: `Basic ${rzpAuth}` } }
      );
      if (!rzpRes.ok) {
        console.error('Razorpay fetch failed:', rzpRes.status, razorpay_payment_id);
        return res.status(400).json({ success: false, error: 'Payment verification failed' });
      }
      payment = await rzpRes.json();
    } catch (e) {
      console.error('Razorpay fetch error:', e);
      return res.status(502).json({ success: false, error: 'Payment verification failed' });
    }

    // Every one of these must hold. Any mismatch => do not activate, do not record.
    const checks = [
      [payment && payment.id === razorpay_payment_id, 'payment id mismatch'],
      [payment.status === 'captured',                 `status is '${payment.status}', not captured`],
      [payment.captured === true,                     'captured flag is not true'],
      [payment.amount === planConfig.amountPaise,     `amount ${payment.amount} != expected ${planConfig.amountPaise}`],
      [payment.currency === CURRENCY,                 `currency ${payment.currency} != ${CURRENCY}`],
      [payment.order_id === razorpay_order_id,        'order_id does not match'],
    ];
    const failed = checks.find(([ok]) => !ok);
    if (failed) {
      console.error('Razorpay payment rejected:', failed[1], razorpay_payment_id);
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    // ── 4. Supabase service-role client ─────────────────────────────────────
    // Required: a trigger (protect_premium_profile_fields) permits is_pro changes
    // only for service_role.
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date();

    // ── 4. Record the payment FIRST (idempotency gate) ───────────────────────
    // UNIQUE(razorpay_payment_id) means a replayed callback cannot create a second
    // record, and therefore cannot extend Pro twice. Recording before activation
    // also guarantees we never grant Pro without an audit trail.
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan,
        amount: planConfig.amountRupees,   // server-side amount (never the browser's)
        status: 'success',
        created_at: now.toISOString(),
      });

    let isReplay = false;
    if (insertError) {
      if (insertError.code === UNIQUE_VIOLATION) {
        isReplay = true;

        // A payment id must never activate a different account.
        const { data: existing, error: lookupError } = await supabase
          .from('payments')
          .select('user_id')
          .eq('razorpay_payment_id', razorpay_payment_id)
          .maybeSingle();

        if (lookupError) {
          console.error('Duplicate lookup failed:', lookupError);
          return res.status(500).json({ success: false, error: 'Payment verification failed' });
        }
        if (!existing || existing.user_id !== user_id) {
          console.error('Payment id replayed for a different user');
          return res.status(409).json({ success: false, error: 'Payment already processed' });
        }
      } else {
        // Do NOT hide payment-insert failures (the old code only logged them).
        console.error('Payment record error:', insertError);
        return res.status(500).json({ success: false, error: 'Could not record payment' });
      }
    }

    // ── 5. Replay: never extend an already-active subscription ───────────────
    if (isReplay) {
      const { data: prof, error: profReadError } = await supabase
        .from('profiles')
        .select('is_pro, pro_expires_at')
        .eq('id', user_id)
        .maybeSingle();

      if (profReadError) {
        console.error('Profile read error:', profReadError);
        return res.status(500).json({ success: false, error: 'Failed to activate Pro' });
      }

      if (prof?.is_pro === true && prof.pro_expires_at && new Date(prof.pro_expires_at) > now) {
        return res.status(200).json({
          success: true,
          already_processed: true,
          expires_at: prof.pro_expires_at,   // existing expiry, NOT extended
        });
      }
      // Else: payment recorded but activation never completed. Activate now.
    }

    // ── 6. Activate Pro and PROVE what was written ───────────────────────────
    // profiles has only is_pro and pro_expires_at. The previous code also wrote
    // `updated_at`, which does not exist — Postgres rejected the whole UPDATE
    // (42703), so is_pro was never set. That was the outage.
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + planConfig.months);

    const { data: updatedRows, error: profileError } = await supabase
      .from('profiles')
      .update({
        is_pro: true,
        pro_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user_id)
      .select('id, is_pro, pro_expires_at');

    if (profileError) {
      console.error('Profile update error:', profileError);
      return res.status(500).json({ success: false, error: 'Failed to activate Pro' });
    }

    // A zero-row update returns NO error from Supabase. Never call that success.
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      console.error('No profile matched user_id:', user_id);
      return res.status(500).json({ success: false, error: 'Failed to activate Pro' });
    }
    if (updatedRows.length > 1) {
      console.error('Unexpected: multiple profiles matched user_id:', user_id);
      return res.status(500).json({ success: false, error: 'Failed to activate Pro' });
    }

    const activated = updatedRows[0];
    if (activated.is_pro !== true || !activated.pro_expires_at) {
      console.error('Activation did not persist:', activated);
      return res.status(500).json({ success: false, error: 'Failed to activate Pro' });
    }

    return res.status(200).json({
      success: true,
      expires_at: activated.pro_expires_at,   // echo what the DB actually stored
    });

  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
