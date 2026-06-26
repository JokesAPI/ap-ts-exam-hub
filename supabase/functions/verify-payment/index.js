// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: verify-payment
// Location: supabase/functions/verify-payment/index.js
//
// HOW IT WORKS:
// 1. Frontend sends: { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, plan }
// 2. This function verifies the signature using Razorpay secret (server-side only)
// 3. If valid → updates profiles.is_pro = true using SERVICE ROLE key (not anon)
// 4. Frontend never touches the database directly for payment
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_id,
      plan
    } = await req.json()

    // ── 1. Validate required fields ───────────────────────────────────────────
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Verify Razorpay signature (SERVER SIDE ONLY) ──────────────────────
    // Signature = HMAC-SHA256(order_id + "|" + payment_id, razorpay_secret)
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!razorpaySecret) {
      console.error('RAZORPAY_KEY_SECRET not set')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(razorpaySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // ── 3. Compare signatures ─────────────────────────────────────────────────
    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch - possible fraud attempt')
      return new Response(
        JSON.stringify({ success: false, error: 'Payment verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Signature valid -- update database with SERVICE ROLE key ───────────
    // SERVICE ROLE key bypasses RLS -- never send this to frontend
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') // NOT the anon key
    )

    // Calculate expiry date based on plan
    const now = new Date()
    const expiresAt = new Date(now)
    if (plan === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1) // default monthly
    }

    // Update profile to Pro
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_pro: true,
        pro_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', user_id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to activate Pro' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan,
        amount: plan === 'yearly' ? 199 * 12 : 199,
        status: 'success',
        created_at: now.toISOString()
      })

    if (paymentError) {
      console.error('Payment record error:', paymentError) // non-fatal, Pro already activated
    }

    return new Response(
      JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
