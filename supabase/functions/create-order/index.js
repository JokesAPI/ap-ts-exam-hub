// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: create-order
// Location: supabase/functions/create-order/index.js
//
// Creates a Razorpay order server-side
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { amount, plan, user_id } = await req.json()

    if (!amount || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing amount or user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    // Create Razorpay order via their API
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(keyId + ':' + keySecret),
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt:  'order_' + user_id.slice(0, 8) + '_' + Date.now(),
        notes:    { user_id, plan },
      }),
    })

    const order = await response.json()

    if (!response.ok) {
      throw new Error(order.error?.description || 'Razorpay order creation failed')
    }

    return new Response(
      JSON.stringify({ order_id: order.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
