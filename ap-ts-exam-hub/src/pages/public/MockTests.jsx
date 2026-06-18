import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { FileText, Clock, Users, Lock, CheckCircle, Star } from 'lucide-react'

const FREE_MOCK_LIMIT = 2
const MOCK_KEY = 'mock_tests_used'

const mockTests = [
  { id: 1, title: 'APPSC Group-2 General Studies', questions: 50, time: 60, difficulty: 'Medium', attempts: 1240, free: true },
  { id: 2, title: 'TSPSC Group-1 Prelims', questions: 50, time: 60, difficulty: 'Hard', attempts: 980, free: true },
  { id: 3, title: 'AP Police SI General Ability', questions: 50, time: 60, difficulty: 'Medium', attempts: 756, free: false },
  { id: 4, title: 'APPSC Panchayat Secretary', questions: 50, time: 60, difficulty: 'Easy', attempts: 1100, free: false },
  { id: 5, title: 'TSPSC Group-2 Current Affairs', questions: 25, time: 30, difficulty: 'Medium', attempts: 890, free: false },
  { id: 6, title: 'AP DSC Child Development', questions: 50, time: 60, difficulty: 'Medium', attempts: 670, free: false },
  { id: 7, title: 'Indian Constitution MCQs', questions: 30, time: 35, difficulty: 'Hard', attempts: 540, free: false },
  { id: 8, title: 'AP Economy & Development', questions: 25, time: 30, difficulty: 'Easy', attempts: 430, free: false },
]

export default function MockTests() {
  const [showPaywall, setShowPaywall] = useState(false)
  const usedCount = parseInt(localStorage.getItem(MOCK_KEY) || '0')

  function startTest(test) {
    if (!test.free && usedCount >= FREE_MOCK_LIMIT) {
      setShowPaywall(true)
      return
    }
    if (!test.free) {
      localStorage.setItem(MOCK_KEY, String(usedCount + 1))
    }
    window.location.href = `/genius-ai?mock=${test.title}`
  }

  return (
    <Layout>
      <Helmet>
        <title>Mock Tests - AP TS Exam Hub</title>
        <meta name="description" content="Free mock tests for APPSC, TSPSC, AP Police, TS Police exams. Practice online with instant results." />
      </Helmet>

      <section className="bg-gradient-to-br from-orange-800 to-primary-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">Mock Tests 📋</h1>
          <p className="text-orange-100">Practice with real exam pattern questions</p>
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full">✅ 2 Free Tests</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">⚡ Instant Results</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">📊 Performance Analysis</span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Free limit info */}
        <div className="card p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Free Plan: 2 mock tests available</span>
          </div>
          <a href="#upgrade" className="btn-primary text-sm py-1.5">
            Upgrade ₹99/month — Unlimited Tests
          </a>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {mockTests.map(test => (
            <div key={test.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {test.free ? (
                      <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">FREE</span>
                    ) : (
                      <span className="badge bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">PRO</span>
                    )}
                    <span className={`badge ${test.difficulty === 'Easy' ? 'bg-blue-100 text-blue-700' : test.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {test.difficulty}
                    </span>
                  </div>
                  <h3 className="font-semibold">{test.title}</h3>
                </div>
                {!test.free && usedCount >= FREE_MOCK_LIMIT && (
                  <Lock className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                )}
              </div>

              <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {test.questions} Qs</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {test.time} min</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {test.attempts.toLocaleString()}</span>
              </div>

              <button onClick={() => startTest(test)}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${test.free || usedCount < FREE_MOCK_LIMIT ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                {test.free ? 'Start Free Test' : usedCount < FREE_MOCK_LIMIT ? 'Start Test' : '🔒 Unlock with Pro'}
              </button>
            </div>
          ))}
        </div>

        {/* Upgrade section */}
        <div id="upgrade" className="card p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-center">
          <h2 className="text-2xl font-bold mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Unlock unlimited mock tests + Genius AI</p>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm mx-auto shadow-lg mb-6">
            <p className="text-4xl font-extrabold text-primary-600 mb-1">₹99 <span className="text-lg font-normal text-gray-400">/month</span></p>
            <p className="text-sm text-gray-400 mb-4">Cancel anytime</p>
            <ul className="text-left space-y-2 text-sm mb-5">
              {['Unlimited mock tests', 'Unlimited Genius AI messages', 'Personalized study plans', 'Performance analytics', 'Previous year papers PDF', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full justify-center py-3 text-base">
              Get Pro — ₹99/month
            </a>
          </div>
          <p className="text-xs text-gray-400">Secure payment via Razorpay. Cancel anytime.</p>
        </div>
      </div>

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPaywall(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <Lock className="h-12 w-12 mx-auto mb-3 text-purple-500" />
            <h3 className="text-xl font-bold mb-2">Free Limit Reached!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-5">You have used your 2 free mock tests. Upgrade to continue practicing.</p>
            <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full justify-center py-3 mb-3">
              Upgrade for ₹99/month
            </a>
            <button onClick={() => setShowPaywall(false)} className="btn-secondary w-full justify-center">
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
