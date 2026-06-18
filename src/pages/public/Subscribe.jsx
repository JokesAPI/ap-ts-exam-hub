import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle, Crown, Sparkles, Shield, Zap, Brain, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 199,
    paise: 19900,
    period: 'month',
    color: 'border-blue-300 dark:border-blue-700',
    badge: '',
    features: [
      '30 Genius AI messages/day',
      'All 11 AI sections',
      'Telugu + Hindi + English',
      '20 mock tests/month',
      'Study plans & revision',
      'Job alerts notifications',
      'Daily quiz unlimited',
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    paise: 39900,
    period: 'month',
    color: 'border-purple-400 dark:border-purple-600',
    badge: 'Most Popular',
    features: [
      'Unlimited Genius AI messages',
      'All 11 AI sections unlocked',
      'Telugu + Hindi + English',
      'Unlimited mock tests + timer',
      'Performance analytics',
      'Career roadmaps',
      'Interview preparation',
      'Personalized study plans',
      'PDF downloads',
      'Priority support',
    ]
  },
  {
    id: 'annual',
    name: 'Pro Annual',
    price: 1999,
    paise: 199900,
    period: 'year',
    color: 'border-yellow-400 dark:border-yellow-600',
    badge: 'Best Value — Save ₹2,789',
    features: [
      'Everything in Pro',
      'Save ₹2,789 vs monthly',
      '12 months full access',
      'Unlimited everything',
      'Future features free',
      'VIP support',
    ]
  }
]

const faqs = [
  { q: 'How does payment work?', a: 'Payment is processed securely via Razorpay using UPI, debit/credit card, or net banking.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Your access continues until the end of the billing period after cancellation.' },
  { q: 'Is my data safe?', a: 'Yes. All data is encrypted and stored securely in Supabase. We never share your data.' },
  { q: 'What languages are supported?', a: 'English, Telugu (తెలుగు), and Hindi (हिंदी) — switch anytime inside Genius AI.' },
  { q: 'What exams are covered?', a: 'APPSC Group 1/2/3, TSPSC Group 1/2/4, AP/TS Police, DSC, TET, RRB, SSC and more.' },
  { q: 'What if payment fails?', a: 'Contact us on Telegram @aptsexamhub and we will resolve within 24 hours.' },
]

export default function Subscribe() {
  const { user, profile, isPro, fetchProfile } = useAuth()
  const [loading, setLoading] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('pro')

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  async function handlePayment(plan) {
    if (!user) {
      toast.error('Please login first!')
      window.location.href = '/login'
      return
    }

    setLoading(plan.id)

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: plan.paise,
      currency: 'INR',
      name: 'AP TS Exam Hub',
      description: `Genius AI ${plan.name} — ${plan.period === 'year' ? 'Annual' : 'Monthly'} Plan`,
      image: '/favicon.svg',
      prefill: {
        email: user.email,
        name: profile?.full_name || '',
      },
      notes: {
        plan_id: plan.id,
        user_id: user.id,
      },
      theme: { color: '#2563eb' },
      handler: async function(response) {
        try {
          const expiresAt = new Date()
          if (plan.period === 'year') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1)
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1)
          }

          await supabase.from('subscriptions').insert([{
            user_id: user.id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id || '',
            amount: plan.paise,
            status: 'paid',
            expires_at: expiresAt.toISOString()
          }])

          await supabase.from('profiles').update({
            is_pro: true,
            pro_expires_at: expiresAt.toISOString()
          }).eq('id', user.id)

          await fetchProfile(user.id)
          toast.success('🎉 Welcome to Pro! All features unlocked!')
          window.location.href = '/dashboard'
        } catch {
          toast.error('Payment done but update failed. Contact support on Telegram.')
        }
        setLoading(null)
      },
      modal: { ondismiss: () => setLoading(null) }
    }

    if (!window.Razorpay) {
      toast.error('Payment gateway not loaded. Please refresh page.')
      setLoading(null)
      return
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', () => {
      toast.error('Payment failed. Please try again.')
      setLoading(null)
    })
    rzp.open()
  }

  return (
    <Layout>
      <Helmet>
        <title>Upgrade to Pro - AP TS Exam Hub</title>
        <meta name="description" content="Upgrade to Genius AI Pro for unlimited APPSC TSPSC exam preparation. Starting ₹199/month." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-primary-800 to-primary-600 text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Crown className="h-14 w-14 mx-auto mb-4 text-yellow-300" />
          <h1 className="text-4xl font-extrabold mb-3">Choose Your Plan</h1>
          <p className="text-xl text-blue-100">Unlock Genius AI for APPSC & TSPSC exam success</p>
          <p className="text-blue-200 font-telugu mt-1">మీ పరీక్ష విజయం కోసం సరైన ప్లాన్ ఎంచుకోండి</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {isPro && (
          <div className="card p-5 mb-8 border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-center">
            <Crown className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="font-bold text-lg text-green-700 dark:text-green-300">You are already a Pro member! 🎉</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Pro expires: {new Date(profile?.pro_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <a href="/genius-ai" className="btn-primary mt-3 inline-flex">Go to Genius AI →</a>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-14">
          {plans.map(plan => (
            <div key={plan.id} className={`card p-6 border-2 relative ${plan.id === 'pro' ? 'border-purple-400 dark:border-purple-600 shadow-xl scale-105' : plan.color}`}>
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${plan.id === 'pro' ? 'bg-purple-600 text-white' : 'bg-yellow-500 text-white'}`}>
                  {plan.badge}
                </div>
              )}

              <div className="text-center mb-5 pt-2">
                <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-4xl font-extrabold text-primary-600">₹{plan.price}</span>
                  <span className="text-gray-400 mb-1">/{plan.period}</span>
                </div>
                {plan.id === 'annual' && (
                  <p className="text-xs text-green-600 font-semibold mt-1">Just ₹{Math.round(plan.price/12)}/month</p>
                )}
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>

              <button onClick={() => handlePayment(plan)}
                disabled={loading === plan.id || isPro}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${plan.id === 'pro' ? 'bg-purple-600 hover:bg-purple-700 text-white' : plan.id === 'annual' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'btn-primary'}`}>
                {loading === plan.id ? 'Opening payment...' :
                  isPro ? 'Already Pro ✓' :
                  plan.id === 'annual' ? '🏆 Get Annual Plan' :
                  plan.id === 'pro' ? '⚡ Get Pro Now' :
                  '✅ Get Basic'}
              </button>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {[
            { icon: Shield, label: 'Secure Payment', desc: 'Razorpay encrypted' },
            { icon: Zap, label: 'Instant Access', desc: 'After payment' },
            { icon: Brain, label: 'AI Powered', desc: 'Groq Llama 3' },
            { icon: Star, label: 'Cancel Anytime', desc: 'No hidden charges' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="card p-4 text-center">
              <Icon className="h-6 w-6 text-primary-600 mx-auto mb-2" />
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Compare free vs pro */}
        <div className="card overflow-hidden mb-14">
          <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-bold text-lg">Free vs Pro Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left font-semibold">Feature</th>
                  <th className="px-5 py-3 text-center font-semibold">Free</th>
                  <th className="px-5 py-3 text-center font-semibold text-blue-600">Basic ₹199</th>
                  <th className="px-5 py-3 text-center font-semibold text-purple-600">Pro ₹399</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  ['Genius AI messages', '5/day', '30/day', 'Unlimited'],
                  ['Mock tests', '2 total', '20/month', 'Unlimited'],
                  ['Languages', 'English only', 'EN + TE + HI', 'EN + TE + HI'],
                  ['Study plans', '❌', '✅', '✅'],
                  ['Career roadmaps', '❌', '❌', '✅'],
                  ['Performance analytics', '❌', '❌', '✅'],
                  ['PDF downloads', '❌', '❌', '✅'],
                  ['Priority support', '❌', '❌', '✅'],
                ].map(([feature, free, basic, pro]) => (
                  <tr key={feature} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium">{feature}</td>
                    <td className="px-5 py-3 text-center text-gray-500">{free}</td>
                    <td className="px-5 py-3 text-center text-blue-600 font-medium">{basic}</td>
                    <td className="px-5 py-3 text-center text-purple-600 font-medium">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="card p-5">
              <p className="font-semibold mb-2">{q}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
