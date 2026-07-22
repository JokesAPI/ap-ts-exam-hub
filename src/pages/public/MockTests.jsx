import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { loadTestCatalog, resolveAccess } from '../../lib/officialTests'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { FileText, Clock, Users, Lock, CheckCircle, Star, ArrowRight, RotateCcw, Trophy, XCircle, ChevronRight, Loader, Sparkles } from 'lucide-react'
import { callGroq } from '../../lib/groq'

// The official catalog now lives in Supabase (mock_tests). The old hardcoded
// mockTests[] array is gone: its ids matched nothing in the DB, it carried
// fabricated attempt counts (1240, 980, ...) while real attempts were 0, and it
// duplicated the catalog. AI Practice reuses the same DB catalog as topic seeds.

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
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  // PR-2: official catalog from Supabase + two clearly-separated modes
  const { user, isPro } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('official')     // 'official' | 'practice'
  const [catalog, setCatalog] = useState(null)     // null = loading
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => {
    let alive = true
    loadTestCatalog(supabase)
      .then(rows => { if (alive) setCatalog(rows) })
      .catch(err => { if (alive) { setCatalogError(err.message); setCatalog([]) } })
    return () => { alive = false }
  }, [])

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

  // ── OFFICIAL test → hand off to the engine (Supabase-backed, RLS-gated) ────
  function startOfficialTest(test) {
    const access = resolveAccess(test.access_tier, { user, isPro })
    if (access === 'login')   { navigate('/login'); return }
    if (access === 'upgrade') { navigate('/subscribe'); return }
    navigate(`/mock-test/start?testId=${encodeURIComponent(test.test_id)}`)
  }

  // ── AI PRACTICE → generated on the fly. Never scored, never ranked, never
  //    written to mock_results, and never inserted into the official bank.
  async function startTest(test) {
    setSelectedTest(test)
    setScreen('loading')
    setError('')
    setAnswers({})
    setRevealed({})
    setCurrentQ(0)

    const prompt = `Generate exactly 10 MCQ questions for the ${test.title} exam on the topic "${test.subject || test.title}". 
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
      const systemPrompt = `You are an expert question setter for Indian government competitive exams (APPSC, TGPSC, SSC, Police, DSC, TET). Generate high-quality MCQ questions. Always follow the exact format given. Never use ** or ## or backticks.`
      const reply = await callGroq(systemPrompt, [{ role: 'user', content: prompt }])
      const parsed = parseQuestions(reply)
      if (parsed.length < 5) throw new Error('Could not parse questions. Please try again.')
      setQuestions(parsed)
      setTimeLeft(10 * 60)   // AI Practice: fixed 10-minute practice window
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
        <Helmet><title>{selectedTest?.title} -- Mock Test</title></Helmet>

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
        <Helmet><title>Results -- {selectedTest?.title}</title></Helmet>
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
               pct >= 40 ? '📚 Keep studying -- you can do it!' :
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
        <title>Free APPSC TSPSC Mock Test Online 2024 | AP TS Exam Hub</title>
        <meta name="description" content="Practice free APPSC Group-2, TSPSC Group-1, AP Police SI mock tests online. AI-generated fresh questions, live timer, instant results and full answer review." />
        <meta name="keywords" content="APPSC mock test free, TSPSC online test, AP police practice test, DSC TET mock test, APPSC Group-2 questions online, Telugu medium mock test 2024" />
        <link rel="canonical" href="https://ap-ts-exam-hub.vercel.app/mock-tests" />
        <meta property="og:title" content="Free APPSC TSPSC Mock Test Online | AP TS Exam Hub" />
        <meta property="og:description" content="Practice APPSC Group-2, TSPSC Group-1, AP Police mock tests free online. AI questions, live timer, instant feedback and score review." />
        <meta property="og:url" content="https://ap-ts-exam-hub.vercel.app/mock-tests" />
        <meta property="og:image" content="https://ap-ts-exam-hub.vercel.app/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free APPSC TSPSC Mock Test | AP TS Exam Hub" />
        <meta name="twitter:description" content="Practice free mock tests for APPSC, TSPSC, AP Police exams with instant results." />
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

        {/* ── Mode switch: Official (Supabase, scored) vs AI Practice (unscored) ── */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setMode('official')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === 'official' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            Official Mock Tests
          </button>
          <button onClick={() => setMode('practice')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === 'practice' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            AI Practice
          </button>
        </div>

        {mode === 'official' ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Human-reviewed questions from our official question bank. Scored, saved to your history and counted in analytics.
          </p>
        ) : (
          <div className="card p-4 mb-5 border-l-4 border-yellow-400 bg-yellow-50/60 dark:bg-yellow-900/10">
            <p className="text-sm font-semibold mb-1">AI Practice — not an official test</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Questions are generated by AI for unlimited practice. They are <b>not reviewed</b>, produce <b>no rank</b>,
              <b> no official score</b>, and are <b>not saved</b> to your attempt history. For scored practice, use Official Mock Tests.
            </p>
          </div>
        )}

        {catalogError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            ⚠️ {catalogError}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {catalog === null ? (
            [0, 1, 2, 3].map(i => <div key={i} className="card p-5 h-40 animate-pulse bg-gray-100 dark:bg-gray-800" />)
          ) : catalog.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-2">No tests are available yet.</p>
          ) : catalog.map(test => {
            const access = resolveAccess(test.access_tier, { user, isPro })
            const locked = mode === 'official' && access !== 'start'
            return (
              <div key={test.test_id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {test.access_tier === 'public' && (
                        <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">FREE</span>
                      )}
                      {test.access_tier === 'free' && (
                        <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">LOGIN</span>
                      )}
                      {test.access_tier === 'premium' && (
                        <span className="badge bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">PRO</span>
                      )}
                    </div>
                    <h3 className="font-semibold truncate">{test.title}</h3>
                    {test.subject && <p className="text-xs text-gray-400 mt-0.5">{test.subject}</p>}
                  </div>
                  {locked && <Lock className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />}
                </div>

                {mode === 'official' ? (
                  <button onClick={() => startOfficialTest(test)}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white">
                    {access === 'start'   && <><ArrowRight className="h-4 w-4" /> Start Test</>}
                    {access === 'login'   && <><Lock className="h-4 w-4" /> Login Required</>}
                    {access === 'upgrade' && <><Lock className="h-4 w-4" /> Upgrade Required</>}
                  </button>
                ) : (
                  <button onClick={() => startTest(test)}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white">
                    <Sparkles className="h-4 w-4" /> Generate AI Practice
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Upgrade */}
        <div id="upgrade" className="card p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-center">
          <h2 className="text-2xl font-bold mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Unlock unlimited mock tests + Genius AI</p>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm mx-auto shadow-lg mb-6">
            <p className="text-4xl font-extrabold text-primary-600 mb-1">₹199 <span className="text-lg font-normal text-gray-400">/month</span></p>
            <p className="text-sm text-gray-400 mb-4">Cancel anytime</p>
            <ul className="text-left space-y-2 text-sm mb-5">
              {['Unlimited mock tests', 'Unlimited Genius AI messages', 'Personalized study plans', 'Performance analytics', 'Previous year papers PDF', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            {/* Must go through /subscribe. A direct Razorpay payment link
                (previously https://rzp.io/rzp/JuthfaVR) bypasses /api/create-order
                and /api/verify-payment entirely, so the payment is captured but
                Pro is never activated and no payments row is written. */}
            <Link to="/subscribe"
              className="btn-primary w-full justify-center py-3 text-base">
              Get Pro -- ₹199/month
            </Link>
          </div>
          <p className="text-xs text-gray-400">Secure payment via Razorpay. Cancel anytime.</p>
        </div>
      </div>

      {/* (Removed in PR-2) The legacy "Free Limit Reached" modal lived here. It
          was driven by the localStorage quota (showPaywall / mock_tests_used /
          FREE_MOCK_LIMIT), which was bypassable by clearing browser storage.
          Access is now decided per-test by access_tier and enforced by RLS:
          public -> Start, anon+free -> Login Required, free user+premium ->
          Upgrade Required, premium -> Start. */}
    </Layout>
  )
}
