import { useState, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { FileText, Clock, Users, Lock, CheckCircle, Star, ArrowRight, RotateCcw, Trophy, XCircle, ChevronRight, Loader } from 'lucide-react'
import { callGroq } from '../../lib/groq'

const FREE_MOCK_LIMIT = 2
const MOCK_KEY = 'mock_tests_used'

const mockTests = [
  { id: 1, title: 'APPSC Group-2 General Studies', subject: 'General Studies', exam: 'APPSC Group-2', questions: 10, time: 10, difficulty: 'Medium', attempts: 1240, free: true },
  { id: 2, title: 'TSPSC Group-1 Prelims', subject: 'General Studies', exam: 'TSPSC Group-1', questions: 10, time: 10, difficulty: 'Hard', attempts: 980, free: true },
  { id: 3, title: 'AP Police SI General Ability', subject: 'General Ability', exam: 'AP Police SI', questions: 10, time: 10, difficulty: 'Medium', attempts: 756, free: false },
  { id: 4, title: 'APPSC Panchayat Secretary', subject: 'AP Economy & Polity', exam: 'APPSC Panchayat Secretary', questions: 10, time: 10, difficulty: 'Easy', attempts: 1100, free: false },
  { id: 5, title: 'TSPSC Group-2 Current Affairs', subject: 'Current Affairs', exam: 'TSPSC Group-2', questions: 10, time: 10, difficulty: 'Medium', attempts: 890, free: false },
  { id: 6, title: 'AP DSC Child Development', subject: 'Child Development & Pedagogy', exam: 'AP DSC', questions: 10, time: 10, difficulty: 'Medium', attempts: 670, free: false },
  { id: 7, title: 'Indian Constitution MCQs', subject: 'Indian Polity & Constitution', exam: 'APPSC/TSPSC', questions: 10, time: 10, difficulty: 'Hard', attempts: 540, free: false },
  { id: 8, title: 'AP Economy & Development', subject: 'AP Economy', exam: 'APPSC Group-2', questions: 10, time: 10, difficulty: 'Easy', attempts: 430, free: false },
]

// ── Parse AI text into structured questions ──────────────────────────────────
function parseQuestions(text) {
  const questions = []
  // Split by Q1. Q2. etc.
  const blocks = text.split(/\nQ\d+\.\s+/).filter(Boolean)
  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 6) continue
    const question = lines[0]
    const options = {}
    let answer = ''
    let explanation = ''
    for (const line of lines.slice(1)) {
      if (/^A\)/.test(line)) options.A = line.replace('A)', '').trim()
      else if (/^B\)/.test(line)) options.B = line.replace('B)', '').trim()
      else if (/^C\)/.test(line)) options.C = line.replace('C)', '').trim()
      else if (/^D\)/.test(line)) options.D = line.replace('D)', '').trim()
      else if (/^Answer:/i.test(line)) answer = line.replace(/^Answer:/i, '').trim().toUpperCase().charAt(0)
      else if (/^Explanation:/i.test(line)) explanation = line.replace(/^Explanation:/i, '').trim()
    }
    if (question && options.A && options.B && answer) {
      questions.push({ question, options, answer, explanation })
    }
  }
  return questions
}

// ── Score color helper ────────────────────────────────────────────────────────
function scoreColor(pct) {
  if (pct >= 80) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MockTests() {
  const [screen, setScreen] = useState('list')   // list | loading | quiz | result
  const [selectedTest, setSelectedTest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})      // { 0: 'A', 1: 'C', ... }
  const [revealed, setRevealed] = useState({})    // which questions are revealed
  const [timeLeft, setTimeLeft] = useState(0)
  const [showPaywall, setShowPaywall] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const usedCount = parseInt(localStorage.getItem(MOCK_KEY) || '0')

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'quiz' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); finishTest(); return 0 }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [screen])

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Start test ─────────────────────────────────────────────────────────────
  async function startTest(test) {
    if (!test.free && usedCount >= FREE_MOCK_LIMIT) { setShowPaywall(true); return }
    if (!test.free) localStorage.setItem(MOCK_KEY, String(usedCount + 1))

    setSelectedTest(test)
    setScreen('loading')
    setError('')
    setAnswers({})
    setRevealed({})
    setCurrentQ(0)

    const prompt = `Generate exactly 10 MCQ questions for ${test.exam} exam on the topic "${test.subject}". 
Format STRICTLY as:
Q1. [Question text]
A) [option]
B) [option]
C) [option]
D) [option]
Answer: [A/B/C/D]
Explanation: [one sentence]

Q2. ...and so on up to Q10.
Make questions relevant to Indian government exam syllabus. Do not use markdown.`

    try {
      const systemPrompt = `You are an expert question setter for Indian government competitive exams (APPSC, TSPSC, SSC, Police, DSC, TET). Generate high-quality MCQ questions. Always follow the exact format given. Never use ** or ## or backticks.`
      const reply = await callGroq(systemPrompt, [{ role: 'user', content: prompt }])
      const parsed = parseQuestions(reply)
      if (parsed.length < 5) throw new Error('Could not parse questions. Please try again.')
      setQuestions(parsed)
      setTimeLeft(test.time * 60)
      setScreen('quiz')
    } catch (err) {
      setError(err.message)
      setScreen('list')
    }
  }

  // ── Select answer ──────────────────────────────────────────────────────────
  function selectAnswer(letter) {
    if (revealed[currentQ]) return  // already answered
    setAnswers(prev => ({ ...prev, [currentQ]: letter }))
    setRevealed(prev => ({ ...prev, [currentQ]: true }))
  }

  // ── Navigate ───────────────────────────────────────────────────────────────
  function nextQuestion() {
    if (currentQ < questions.length - 1) setCurrentQ(q => q + 1)
    else finishTest()
  }

  function finishTest() {
    clearInterval(timerRef.current)
    setScreen('result')
  }

  // ── Score calc ─────────────────────────────────────────────────────────────
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0)
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0

  // ── Option style ───────────────────────────────────────────────────────────
  function optionStyle(qIdx, letter) {
    if (!revealed[qIdx]) {
      return answers[qIdx] === letter
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
        : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 cursor-pointer'
    }
    const q = questions[qIdx]
    if (letter === q.answer) return 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
    if (letter === answers[qIdx] && letter !== q.answer) return 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
    return 'border-gray-200 dark:border-gray-700 opacity-50'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  // ── Loading screen ────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <Layout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <Loader className="h-10 w-10 text-primary-600 animate-spin" />
        <h2 className="text-xl font-bold">Generating your test...</h2>
        <p className="text-gray-500 text-sm">AI is creating 10 fresh questions for {selectedTest?.title}</p>
      </div>
    </Layout>
  )

  // ── Quiz screen ───────────────────────────────────────────────────────────
  if (screen === 'quiz') {
    const q = questions[currentQ]
    const isAnswered = !!revealed[currentQ]
    const isCorrect = answers[currentQ] === q.answer

    return (
      <Layout>
        <Helmet><title>{selectedTest?.title} — Mock Test</title></Helmet>

        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">{selectedTest?.title}</p>
              <p className="text-sm font-bold">Q{currentQ + 1} / {questions.length}</p>
            </div>
            {/* Progress bar */}
            <div className="flex-1 mx-4 hidden sm:block">
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full transition-all"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
              </div>
            </div>
            {/* Timer */}
            <div className={`flex items-center gap-1.5 font-mono font-bold text-sm px-3 py-1.5 rounded-lg ${timeLeft < 60 ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
              <Clock className="h-3.5 w-3.5" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* Question card */}
          <div className="card p-6 mb-5">
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-3">
              Question {currentQ + 1}
            </p>
            <p className="text-base sm:text-lg font-medium leading-relaxed">{q.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {['A', 'B', 'C', 'D'].map(letter => (
              q.options[letter] && (
                <button key={letter}
                  onClick={() => selectAnswer(letter)}
                  disabled={isAnswered}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${optionStyle(currentQ, letter)}`}>
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold
                    ${revealed[currentQ] && letter === q.answer ? 'border-green-500 bg-green-500 text-white' :
                      revealed[currentQ] && letter === answers[currentQ] && letter !== q.answer ? 'border-red-500 bg-red-500 text-white' :
                      'border-current'}`}>
                    {letter}
                  </span>
                  <span className="text-sm sm:text-base">{q.options[letter]}</span>
                  {revealed[currentQ] && letter === q.answer && <CheckCircle className="ml-auto h-5 w-5 text-green-500 flex-shrink-0" />}
                  {revealed[currentQ] && letter === answers[currentQ] && letter !== q.answer && <XCircle className="ml-auto h-5 w-5 text-red-500 flex-shrink-0" />}
                </button>
              )
            ))}
          </div>

          {/* Explanation + Next */}
          {isAnswered && (
            <div className={`card p-4 mb-5 border-l-4 ${isCorrect ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' : 'border-l-red-500 bg-red-50 dark:bg-red-900/10'}`}>
              <p className={`text-sm font-bold mb-1 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {isCorrect ? '✅ Correct!' : `❌ Wrong! Correct answer: ${q.answer}`}
              </p>
              {q.explanation && <p className="text-sm text-gray-600 dark:text-gray-300">{q.explanation}</p>}
            </div>
          )}

          <div className="flex gap-3">
            {!isAnswered && (
              <button onClick={() => setRevealed(prev => ({ ...prev, [currentQ]: true }))}
                className="btn-secondary flex-1 justify-center">
                Skip
              </button>
            )}
            <button onClick={nextQuestion}
              disabled={!isAnswered}
              className="btn-primary flex-1 justify-center disabled:opacity-40">
              {currentQ < questions.length - 1 ? (
                <><ArrowRight className="h-4 w-4" /> Next Question</>
              ) : (
                <><Trophy className="h-4 w-4" /> Finish Test</>
              )}
            </button>
          </div>

          {/* Question dots */}
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                  i === currentQ ? 'border-primary-600 bg-primary-600 text-white' :
                  answers[i] === questions[i].answer ? 'border-green-500 bg-green-100 text-green-700' :
                  answers[i] ? 'border-red-500 bg-red-100 text-red-700' :
                  'border-gray-300 dark:border-gray-700 text-gray-500'
                }`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  if (screen === 'result') {
    return (
      <Layout>
        <Helmet><title>Results — {selectedTest?.title}</title></Helmet>
        <div className="max-w-3xl mx-auto px-4 py-10">

          {/* Score card */}
          <div className="card p-8 text-center mb-8">
            <Trophy className={`h-16 w-16 mx-auto mb-3 ${pct >= 80 ? 'text-yellow-500' : pct >= 50 ? 'text-blue-500' : 'text-gray-400'}`} />
            <h2 className="text-2xl font-extrabold mb-1">{selectedTest?.title}</h2>
            <p className={`text-6xl font-extrabold my-4 ${scoreColor(pct)}`}>{score}/{questions.length}</p>
            <p className={`text-xl font-bold mb-2 ${scoreColor(pct)}`}>{pct}%</p>
            <p className="text-gray-500 mb-6">
              {pct >= 80 ? '🎉 Excellent! You are well prepared!' :
               pct >= 60 ? '👍 Good job! Keep practicing!' :
               pct >= 40 ? '📚 Keep studying — you can do it!' :
               '💪 Don\'t give up! Review the topics and try again.'}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => startTest(selectedTest)} className="btn-primary">
                <RotateCcw className="h-4 w-4" /> Retry Test
              </button>
              <button onClick={() => setScreen('list')} className="btn-secondary">
                All Tests
              </button>
            </div>
          </div>

          {/* Answer review */}
          <h3 className="text-lg font-bold mb-4">Answer Review</h3>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const correct = answers[i] === q.answer
              return (
                <div key={i} className={`card p-5 border-l-4 ${correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    {correct
                      ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium">Q{i + 1}. {q.question}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    {['A', 'B', 'C', 'D'].map(letter => q.options[letter] && (
                      <div key={letter}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5
                          ${letter === q.answer ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium' :
                            letter === answers[i] && !correct ? 'bg-red-100 dark:bg-red-900/20 text-red-600 line-through' :
                            'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}>
                        <span className="font-bold">{letter})</span> {q.options[letter]}
                        {letter === q.answer && <CheckCircle className="h-3 w-3 ml-auto" />}
                      </div>
                    ))}
                  </div>
                  {!correct && answers[i] && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Your answer: {answers[i]}) {q.options[answers[i]]}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-800 rounded p-2">
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Layout>
    )
  }

  // ── List screen (default) ─────────────────────────────────────────────────
  return (
    <Layout>
      <Helmet>
        <title>Mock Tests - AP TS Exam Hub</title>
        <meta name="description" content="Free mock tests for APPSC, TSPSC, AP Police, TS Police exams. Practice online with instant results." />
      </Helmet>

      <section className="bg-gradient-to-br from-orange-800 to-primary-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">Mock Tests 📋</h1>
          <p className="text-orange-100">AI-generated fresh questions every time you practice</p>
          <div className="flex justify-center gap-3 mt-4 text-sm flex-wrap">
            <span className="bg-white/20 px-3 py-1 rounded-full">✅ 2 Free Tests</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">🤖 AI Generated</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">⚡ Instant Results</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">📊 Answer Review</span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="card p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Free Plan: {Math.max(0, FREE_MOCK_LIMIT - usedCount)} test{Math.max(0, FREE_MOCK_LIMIT - usedCount) !== 1 ? 's' : ''} remaining</span>
          </div>
          <a href="#upgrade" className="btn-primary text-sm py-1.5">
            Upgrade ₹99/month — Unlimited Tests
          </a>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {mockTests.map(test => {
            const locked = !test.free && usedCount >= FREE_MOCK_LIMIT
            return (
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
                    <p className="text-xs text-gray-400 mt-0.5">{test.subject}</p>
                  </div>
                  {locked && <Lock className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />}
                </div>

                <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {test.questions} Qs</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {test.time} min</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {test.attempts.toLocaleString()}</span>
                </div>

                <button onClick={() => startTest(test)}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${locked ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}>
                  {locked ? (
                    <><Lock className="h-4 w-4" /> Unlock with Pro</>
                  ) : (
                    <><ArrowRight className="h-4 w-4" /> {test.free ? 'Start Free Test' : 'Start Test'}</>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Upgrade */}
        <div id="upgrade" className="card p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-center">
          <h2 className="text-2xl font-bold mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Unlock unlimited mock tests + Genius AI</p>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm mx-auto shadow-lg mb-6">
            <p className="text-4xl font-extrabold text-primary-600 mb-1">₹99 <span className="text-lg font-normal text-gray-400">/month</span></p>
            <p className="text-sm text-gray-400 mb-4">Cancel anytime</p>
            <ul className="text-left space-y-2 text-sm mb-5">
              {['Unlimited mock tests', 'Unlimited Genius AI messages', 'Personalized study plans', 'Performance analytics', 'Previous year papers PDF', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />{f}
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
