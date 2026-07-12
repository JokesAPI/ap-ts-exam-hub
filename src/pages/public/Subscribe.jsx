import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import { CheckCircle, Zap, Shield, Star } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Load Razorpay SDK ─────────────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const PLANS = [
  {
    id:       'monthly',
    label:    'Monthly',
    price:    199,
    original: 399,
    period:   '/month',
    badge:    null,
  },
  {
    id:       'yearly',
    label:    'Yearly',
    price:    999,
    original: 4788,
    period:   '/year',
    badge:    'Best Value -- Save 79%',
  },
]

const FEATURES = [
  'Unlimited Genius AI messages',
  'All 11 AI tools unlocked',
  'Telugu + Hindi + English support',
  'Unlimited mock tests',
  'Personalized study plans',
  'Weakness analyzer',
  'Current affairs daily',
  'Priority support',
]

export default function Subscribe() {
  const { user, fetchProfile } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [loading,      setLoading]      = useState(false)

  async function handlePayment() {
    if (!user) {
      toast.error('Please login first to subscribe')
      return
    }

    setLoading(true)

    try {
      // ── Step 1: Load Razorpay SDK ───────────────────────────────────────────
      const sdkLoaded = await loadRazorpay()
      if (!sdkLoaded) {
        toast.error('Could not load payment gateway. Check your internet connection.')
        setLoading(false)
        return
      }

      const plan  = PLANS.find(p => p.id === selectedPlan)
      const amount = plan.price * 100 // Razorpay needs paise

      // ── Step 2: Create order via Supabase Edge Function ─────────────────────
      // IMPORTANT: Order creation on server, not client
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, plan: selectedPlan, user_id: user.id }),
      })

      if (!orderRes.ok) {
        const err = await orderRes.json()
        throw new Error(err.error || 'Failed to create order')
      }

      const { order_id } = await orderRes.json()

      // ── Step 3: Open Razorpay checkout ──────────────────────────────────────
      const options = {
        key:         import.meta.env.VITE_RAZORPAY_KEY_ID, // Only KEY ID -- never secret
        amount,
        currency:    'INR',
        name:        'AP TS Exam Hub',
        description: `Pro Plan -- ${plan.label}`,
        order_id,
        prefill: {
          email: user.email,
        },
        theme: { color: '#2563eb' },

        handler: async function (response) {
          // ── Step 4: Verify payment SERVER-SIDE via Edge Function ─────────────
          // NEVER update database here directly -- always verify on server
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                user_id:             user.id,
                plan:                selectedPlan,
              }),
            })

            // Never assume success: check the HTTP status, then parse safely,
            // then require an explicit success flag from the server.
            let result = null
            try {
              result = await verifyRes.json()
            } catch {
              result = null   // non-JSON body (e.g. an HTML error page)
            }

            if (verifyRes.ok && result?.success === true) {
              // Refresh profile ONLY after the server confirmed activation.
              await fetchProfile(user.id)
              toast.success('Payment successful! Pro activated.')
              window.location.href = '/genius-ai'
            } else {
              const reason = result?.error || `Verification failed (HTTP ${verifyRes.status})`
              toast.error(
                `Payment received but activation failed. Please contact support with payment ID: ${response.razorpay_payment_id}`
              )
              console.error('Verification failed:', reason)
            }
          } catch (err) {
            toast.error('Verification error. Please contact support with payment ID: ' + response.razorpay_payment_id)
            console.error('Verify error:', err)
          }
          setLoading(false)
        },

        modal: {
          ondismiss: () => {
            toast('Payment cancelled.')
            setLoading(false)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        toast.error('Payment failed: ' + (response.error?.description || 'Unknown error'))
        console.error('Payment failed:', response.error)
        setLoading(false)
      })
      rzp.open()

    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.')
      console.error('Payment error:', err)
      setLoading(false)
    }
  }

  return (
    <Layout>
      <Helmet>
        <title>Subscribe to Pro -- AP TS Exam Hub</title>
        <meta name="description" content="Upgrade to Pro for unlimited mock tests, Genius AI, and more for APPSC TSPSC exam preparation." />
      </Helmet>

      <section className="bg-gradient-to-br from-primary-800 to-primary-600 text-white py-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 px-4 py-1.5 rounded-full text-yellow-300 text-sm font-semibold mb-4">
            <Zap className="h-4 w-4" /> Unlock Full Access
          </div>
          <h1 className="text-3xl font-extrabold mb-2">Upgrade to Pro</h1>
          <p className="text-blue-200">Unlimited AI mentor, mock tests, and more</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Plan selector */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {PLANS.map(plan => (
            <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
              className={`card p-6 text-left transition-all border-2 ${selectedPlan === plan.id ? 'border-primary-500 shadow-lg' : 'border-transparent hover:border-primary-300'}`}>
              {plan.badge && (
                <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full mb-2">
                  {plan.badge}
                </span>
              )}
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-primary-600">Rs.{plan.price}</span>
                <span className="text-gray-400 text-sm mb-1">{plan.period}</span>
              </div>
              <p className="text-xs text-gray-400 line-through">Rs.{plan.original}</p>
              <p className="text-sm font-semibold mt-2">{plan.label} Plan</p>
              {selectedPlan === plan.id && (
                <div className="mt-2 flex items-center gap-1 text-primary-600 text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5" /> Selected
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Features */}
        <div className="card p-6 mb-8">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> What you get with Pro
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Pay button */}
        <div className="text-center">
          {!user ? (
            <div>
              <p className="text-gray-500 mb-4">Please login to subscribe</p>
              <a href="/login" className="btn-primary px-10 py-3 text-base inline-flex">
                Login to Continue
              </a>
            </div>
          ) : (
            <button onClick={handlePayment} disabled={loading}
              className="btn-primary px-12 py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Processing...' : `Pay Rs.${PLANS.find(p => p.id === selectedPlan)?.price} Securely`}
            </button>
          )}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
            <Shield className="h-3.5 w-3.5" />
            Secured by Razorpay. Cancel anytime.
          </div>
        </div>
      </div>
    </Layout>
  )
}
