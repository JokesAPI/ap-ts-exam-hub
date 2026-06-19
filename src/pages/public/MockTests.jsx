import { useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import { FileText, Clock, Users, Play, User, Phone, Mail, MapPin, X, BookOpen, Brain, TrendingUp, Award } from 'lucide-react'

const testCategories = [
  {
    id: 'appsc',
    name: 'APPSC',
    color: 'from-blue-600 to-blue-800',
    icon: '🏛️',
    tests: [
      { id: 'appsc-gs-1', title: 'APPSC Group-2 General Studies', questions: 10, time: 10, difficulty: 'Medium', attempts: 2840 },
      { id: 'ap-history', title: 'AP History & Culture', questions: 10, time: 10, difficulty: 'Medium', attempts: 1920 },
      { id: 'indian-polity', title: 'Indian Polity & Constitution', questions: 10, time: 10, difficulty: 'Medium', attempts: 2210 },
      { id: 'ap-geography', title: 'AP & TS Geography', questions: 10, time: 10, difficulty: 'Easy', attempts: 1540 },
    ]
  },
  {
    id: 'tspsc',
    name: 'TSPSC',
    color: 'from-purple-600 to-purple-800',
    icon: '🏢',
    tests: [
      { id: 'tspsc-gs-1', title: 'TSPSC Group-1 General Studies', questions: 10, time: 10, difficulty: 'Hard', attempts: 1680 },
      { id: 'indian-economy', title: 'Indian Economy', questions: 10, time: 10, difficulty: 'Medium', attempts: 1320 },
      { id: 'general-science', title: 'General Science', questions: 10, time: 10, difficulty: 'Easy', attempts: 1890 },
      { id: 'current-affairs-apts', title: 'AP & TS Current Affairs', questions: 10, time: 10, difficulty: 'Easy', attempts: 2100 },
    ]
  },
]

const difficultyColor = {
  Easy: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

export default function MockTests() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [selectedTest, setSelectedTest] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', state: 'Andhra Pradesh', exam: '' })
  const [submitting, setSubmitting] = useState(false)
  const testsRef = useRef(null)

  function handleStartClick(test) {
    // Check if student info already saved
    const saved = localStorage.getItem('student_info')
    if (saved) {
      const info = JSON.parse(saved)
      navigate('/mock-test/start', { state: { testId: test.id, title: test.title, student: info } })
    } else {
      setSelectedTest(test)
      setForm(prev => ({ ...prev, exam: test.title }))
      setShowForm(true)
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone) {
      return
    }
    setSubmitting(true)

    try {
      // Save to Supabase
      const { supabase } = await import('../../lib/supabase')
      await supabase.from('test_registrations').insert([{
        name: form.name,
        email: form.email,
        phone: form.phone,
        state: form.state,
        exam_target: form.exam,
      }]).then(() => {})

      // Save locally so we don't ask again
      localStorage.setItem('student_info', JSON.stringify(form))

      setShowForm(false)
      navigate('/mock-test/start', {
        state: { testId: selectedTest.id, title: selectedTest.title, student: form }
      })
    } catch {
      // Even if DB fails, save locally and proceed
      localStorage.setItem('student_info', JSON.stringify(form))
      setShowForm(false)
      navigate('/mock-test/start', {
        state: { testId: selectedTest.id, title: selectedTest.title, student: form }
      })
    }
    setSubmitting(false)
  }

  return (
    <Layout>
      <Helmet>
        <title>Free Mock Tests for APPSC TSPSC AP TS Police — AP TS Exam Hub</title>
        <meta name="description" content="Free online mock tests for APPSC Group 1, Group 2, TSPSC Group 1, Group 2, AP Police, TS Police exams with instant results and negative marking." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">Free Mock Tests 📋</h1>
          <p className="text-blue-100 mb-4">Practice with real APPSC & TSPSC exam pattern questions</p>
          <div className="flex justify-center gap-3 flex-wrap text-sm">
            <span className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Real Timer</span>
            <span className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Negative Marking</span>
            <span className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Performance Analysis</span>
            <span className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> 100% Free</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-4">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-4 gap-4 text-center">
          {[
            { v: '8', l: 'Test Series' },
            { v: '200+', l: 'Questions' },
            { v: '-1/3', l: 'Negative Mark' },
            { v: 'Free', l: 'Always' },
          ].map(s => (
            <div key={s.l}>
              <p className="text-lg font-extrabold text-primary-600">{s.v}</p>
              <p className="text-xs text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div ref={testsRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
        {testCategories.map(cat => (
          <div key={cat.id} className="mb-10">
            {/* Category header */}
            <div className={`bg-gradient-to-r ${cat.color} text-white px-5 py-3 rounded-t-xl flex items-center gap-3`}>
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="font-bold text-lg">{cat.name} Test Series</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-1">
              {cat.tests.map(test => (
                <div key={test.id} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold">FREE</span>
                        <span className={`badge text-xs ${difficultyColor[test.difficulty]}`}>{test.difficulty}</span>
                      </div>
                      <h3 className="font-semibold text-sm">{test.title}</h3>
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{test.questions} Questions</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{test.time} min</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{test.attempts.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1.5 rounded-lg mb-3">
                    ⚠️ Negative marking: -1/3 for wrong answer
                  </div>

                  <button onClick={() => handleStartClick(test)}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <Play className="h-4 w-4" /> Start Test
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Student Info Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-4 w-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-7 w-7 text-primary-600" />
              </div>
              <h3 className="font-bold text-lg">Quick Registration</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Register once to access all free mock tests</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs px-3 py-1.5 rounded-lg mt-2 inline-block">
                Starting: <strong>{selectedTest?.title}</strong>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input className="input pl-9" placeholder="Ravi Kumar" required
                    value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="email" className="input pl-9" placeholder="ravi@gmail.com" required
                    value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="tel" className="input pl-9" placeholder="9876543210" required
                    value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select className="input pl-9" value={form.state} onChange={e => setForm({...form, state: e.target.value})}>
                    <option>Andhra Pradesh</option>
                    <option>Telangana</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full btn-primary justify-center py-3 text-base font-bold disabled:opacity-60 mt-2">
                {submitting ? 'Starting...' : '🚀 Start Test Now'}
              </button>
              <p className="text-xs text-center text-gray-400">Your data is safe. We only use it to send exam alerts.</p>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
