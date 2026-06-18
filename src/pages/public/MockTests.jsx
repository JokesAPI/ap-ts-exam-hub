import { useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import { FileText, Clock, Users, CheckCircle, Star, Play } from 'lucide-react'

const mockTests = [
  { id: 1, title: 'APPSC Group-2 General Studies', questions: 10, time: 10, difficulty: 'Medium', attempts: 1240, free: true, testId: 'appsc-gs-1' },
  { id: 2, title: 'TSPSC Group-1 Prelims', questions: 10, time: 10, difficulty: 'Hard', attempts: 980, free: true, testId: 'appsc-gs-1' },
  { id: 3, title: 'AP Police SI General Ability', questions: 10, time: 10, difficulty: 'Medium', attempts: 756, free: true, testId: 'appsc-gs-1' },
  { id: 4, title: 'APPSC Panchayat Secretary', questions: 10, time: 10, difficulty: 'Easy', attempts: 1100, free: true, testId: 'appsc-gs-1' },
  { id: 5, title: 'TSPSC Group-2 Current Affairs', questions: 10, time: 10, difficulty: 'Medium', attempts: 890, free: true, testId: 'appsc-gs-1' },
  { id: 6, title: 'AP DSC Child Development', questions: 10, time: 10, difficulty: 'Medium', attempts: 670, free: true, testId: 'appsc-gs-1' },
  { id: 7, title: 'Indian Constitution MCQs', questions: 10, time: 10, difficulty: 'Hard', attempts: 540, free: true, testId: 'appsc-gs-1' },
  { id: 8, title: 'AP Economy & Development', questions: 10, time: 10, difficulty: 'Easy', attempts: 430, free: true, testId: 'appsc-gs-1' },
]

export default function MockTests() {
  const navigate = useNavigate()
  const testsRef = useRef(null)

  function startTest(test) {
    navigate('/mock-test/start', { state: { testId: test.testId, title: test.title } })
  }

  function scrollToTests() {
    testsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Layout>
      <Helmet>
        <title>Mock Tests - AP TS Exam Hub</title>
        <meta name="description" content="Free mock tests for APPSC, TSPSC, AP Police exams. Practice online with instant results and timer." />
      </Helmet>

      <section className="bg-gradient-to-br from-orange-800 to-primary-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">Mock Tests 📋</h1>
          <p className="text-orange-100 mb-4">Practice with real exam pattern questions — FREE for first month!</p>
          <div className="flex justify-center gap-3 flex-wrap text-sm mb-5">
            <span className="bg-white/20 px-3 py-1 rounded-full">✅ All Tests Free</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">⏱️ Real Timer</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">📊 Instant Results</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">✍️ Answer Review</span>
          </div>
          <button onClick={scrollToTests}
            className="bg-white text-orange-700 font-bold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors inline-flex items-center gap-2">
            <Play className="h-5 w-5" /> Start a Test Now
          </button>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Total Tests', value: mockTests.length },
            { label: 'Questions Each', value: '10' },
            { label: 'Time per Test', value: '10 min' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-xl font-bold text-primary-600">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tests grid */}
        <div ref={testsRef} className="scroll-mt-20">
          <h2 className="font-bold text-xl mb-4">Available Tests</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {mockTests.map(test => (
              <div key={test.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">FREE</span>
                      <span className={`badge text-xs ${
                        test.difficulty === 'Easy' ? 'bg-blue-100 text-blue-700' :
                        test.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'}`}>
                        {test.difficulty}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm">{test.title}</h3>
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {test.questions} Questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {test.time} min</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {test.attempts.toLocaleString()}</span>
                </div>

                <button onClick={() => startTest(test)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <Play className="h-4 w-4" /> Start Test
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Free month banner */}
        <div className="mt-10 card p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 text-center">
          <Star className="h-8 w-8 mx-auto mb-3 text-yellow-500" />
          <h3 className="font-bold text-lg mb-1">🎁 Free for First Month!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">All mock tests are completely free during the launch period. After that — ₹199/month for unlimited access.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/subscribe" className="btn-primary text-sm">View Plans After Free Month</a>
            <a href="/genius-ai" className="btn-secondary text-sm">Try Genius AI Free</a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
