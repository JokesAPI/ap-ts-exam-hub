import { useState, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getQuestionsForTest, TEST_TITLES, SUBJECT_TO_TEST } from '../../lib/questions'
import { loadSession, saveSession, clearSession } from '../../lib/testSession'
import {
  Clock, CheckCircle, XCircle, AlertCircle, Trophy,
  RotateCcw, ChevronLeft, ChevronRight, MinusCircle,
  BarChart2, Target, Lock, Medal, History, PlayCircle,
  TrendingUp, TrendingDown, Sparkles
} from 'lucide-react'

const TEST_TIME_PER_Q  = 60
const FREE_TEST_LIMIT  = 2
const STORAGE_KEY      = 'mock_tests_used_v2'

// ── helpers ──────────────────────────────────────────────────────────────────
function safeGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

export default function MockTestEngine() {
  const { user, isPro } = useAuth()
  const { state }       = useLocation()
  const navigate        = useNavigate()

  const testId    = state?.testId    || 'appsc-gs-1'
  const testTitle = state?.title     || 'APPSC Group-2 General Studies'
  const student   = state?.student   || safeGet('student_info', {})

  const [questions,      setQuestions]      = useState([])
  const [current,        setCurrent]        = useState(0)
  const [answers,        setAnswers]        = useState({})
  const [timeLeft,       setTimeLeft]       = useState(600)
  const [phase,          setPhase]          = useState('loading')
  const [result,         setResult]         = useState(null)
  const [activeSection,  setActiveSection]  = useState('analytics')
  const [paywallMsg,     setPaywallMsg]     = useState('')
  const [saving,         setSaving]         = useState(false)
  // Priority 2 additions
  const [savedSession,   setSavedSession]   = useState(null)  // resumable session
  const [prevAttempts,   setPrevAttempts]   = useState(null)  // null = loading, [] = none
  const [rank,           setRank]           = useState(null)  // get_test_rank row
  const [reviewFilter,   setReviewFilter]   = useState('all') // all|wrong|skipped|correct

  const timerRef   = useRef(null)
  const startTime  = useRef(Date.now())
  const submitted  = useRef(false)
  // Refs mirroring live test state so periodic persistence never reads stale closures
  const questionsRef = useRef([])
  const answersRef   = useRef({})
  const currentRef   = useRef(0)
  const timeLeftRef  = useRef(600)

  // ── Fix #3: Check paywall before loading ─────────────────────────────────
  useEffect(() => {
    if (!isPro) {
      const used = safeGet(STORAGE_KEY, 0)
      if (used >= FREE_TEST_LIMIT) {
        setPhase('paywall')
        setPaywallMsg(`You have used your ${FREE_TEST_LIMIT} free mock tests. Upgrade to Pro for unlimited tests.`)
        return
      }
    }
    // Resume interrupted test (Priority 2): if a saved in-progress session
    // exists for this test, offer to resume instead of starting fresh.
    const saved = loadSession()
    if (saved && saved.testId === testId) {
      setSavedSession(saved)
      setPhase('resume')
      return
    }
    loadQuestions()
  }, [])

  useEffect(() => {
    if (phase !== 'test') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); submitTest(); return 0 }
        timeLeftRef.current = t - 1
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // ── Priority 2: persist in-progress session ───────────────────────────────
  // Refs stay in sync so both persistence paths read fresh values.
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { currentRef.current = current }, [current])

  // ── Priority 2: reload cleanly when navigated to a different test on the
  // same route (e.g. "Recommended next" button). This render's closure sees
  // the new testId, so loadQuestions() picks the right bank.
  const activeTestId = useRef(testId)
  useEffect(() => {
    if (activeTestId.current === testId) return
    activeTestId.current = testId
    setResult(null); setRank(null); setPrevAttempts(null); setReviewFilter('all')
    setActiveSection('analytics')
    setAnswers({}); answersRef.current = {}
    setCurrent(0);  currentRef.current = 0
    submitted.current = false
    setPhase('loading')
    loadQuestions()
  }, [testId])

  function persistSession() {
    if (submitted.current || questionsRef.current.length === 0) return
    saveSession({
      testId,
      testTitle,
      questions: questionsRef.current,
      answers:   answersRef.current,
      current:   currentRef.current,
      timeLeft:  timeLeftRef.current,
    })
  }

  // Save on every answer/navigation change…
  useEffect(() => {
    if (phase === 'test') persistSession()
  }, [answers, current, phase])

  // …and every 10s so timeLeft stays fresh even when idle.
  useEffect(() => {
    if (phase !== 'test') return
    const iv = setInterval(persistSession, 10000)
    return () => clearInterval(iv)
  }, [phase])

  function resumeSavedTest() {
    const s = savedSession
    if (!s) { loadQuestions(); return }
    setQuestions(s.questions)
    questionsRef.current = s.questions
    setAnswers(s.answers || {})
    answersRef.current = s.answers || {}
    setCurrent(Math.min(s.current || 0, s.questions.length - 1))
    currentRef.current = Math.min(s.current || 0, s.questions.length - 1)
    const restored = Math.max(1, Math.min(s.timeLeft ?? 60, s.questions.length * TEST_TIME_PER_Q))
    setTimeLeft(restored)
    timeLeftRef.current = restored
    // Back-date startTime so time_taken stays accurate after resume
    startTime.current = Date.now() - (s.questions.length * TEST_TIME_PER_Q - restored) * 1000
    submitted.current = false
    setPhase('test')
  }

  function startFresh() {
    clearSession()
    setSavedSession(null)
    setAnswers({})
    answersRef.current = {}
    setCurrent(0)
    currentRef.current = 0
    setPhase('loading')
    setTimeout(loadQuestions, 50)
  }

  function loadQuestions() {
    try {
      const localQs  = getQuestionsForTest(testId)
      const fallback = getQuestionsForTest('appsc-gs-1')
      const pool     = (localQs?.length > 0 ? localQs : fallback) || []
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      setQuestions(shuffled)
      questionsRef.current = shuffled
      setTimeLeft(shuffled.length * TEST_TIME_PER_Q)
      timeLeftRef.current = shuffled.length * TEST_TIME_PER_Q
      setPhase('test')
      startTime.current = Date.now()
      submitted.current = false
    } catch (err) {
      console.error('loadQuestions error:', err)
      setPhase('error')
    }
  }

  function selectAnswer(questionId, answer) {
    setAnswers(prev => {
      if (prev[questionId] === answer) {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      }
      return { ...prev, [questionId]: answer }
    })
  }

  async function submitTest() {
    if (submitted.current) return
    submitted.current = true
    clearInterval(timerRef.current)

    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
    let correct = 0, wrong = 0, skipped = 0
    const subjectStats = {}

    const detailedAnswers = questions.map(q => {
      const selected  = answers[q.id]
      const isCorrect = selected === q.correct_answer
      const isSkipped = !selected
      if (isCorrect) correct++
      else if (isSkipped) skipped++
      else wrong++

      const subj = q.subject || 'General'
      if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, wrong: 0, total: 0 }
      subjectStats[subj].total++
      if (isCorrect) subjectStats[subj].correct++
      else if (!isSkipped) subjectStats[subj].wrong++

      return {
        questionId: q.id, question: q.question,
        selected, correct_answer: q.correct_answer,
        correct: isCorrect, skipped: isSkipped,
        explanation: q.explanation, subject: q.subject,
        option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d,
      }
    })

    const rawScore      = correct - wrong / 3
    const marksObtained = Math.round(rawScore * 100) / 100
    const maxMarks      = questions.length
    const percentage    = Math.max(0, Math.round((marksObtained / maxMarks) * 100))
    const accuracy      = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0

    const resultData = {
      correct, wrong, skipped,
      marksObtained, maxMarks, percentage, accuracy,
      timeTaken, detailedAnswers, subjectStats,
      total: questions.length,
    }
    setResult(resultData)
    setPhase('result')

    // Priority 2: an interrupted-session snapshot is no longer needed
    clearSession()
    setSavedSession(null)

    // ── Fix #7: Properly save mock result with user_id + await + error handling
    if (user?.id) {
      setSaving(true)
      try {
        // Priority 2: fetch previous attempts BEFORE inserting this one, so
        // the list/deltas naturally exclude the attempt just finished.
        const { data: prev } = await supabase.from('mock_results')
          .select('id, percentage, score, total, accuracy, subject_stats, created_at')
          .eq('user_id', user.id)
          .eq('test_id', testId)
          .order('created_at', { ascending: false })
          .limit(10)
        setPrevAttempts(prev || [])

        const { error } = await supabase.from('mock_results').insert([{
          user_id:      user.id,
          test_id:      testId,
          test_title:   testTitle,
          score:        correct,
          total:        questions.length,
          marks:        marksObtained,
          percentage,
          accuracy,
          time_taken:   timeTaken,
          answers:      detailedAnswers,
          subject_stats: subjectStats,
          created_at:   new Date().toISOString(),
        }])
        if (error) console.error('Save result error:', error)

        // Priority 2: rank prediction via existing get_test_rank RPC
        // (SECURITY DEFINER, authenticated-only). Called after insert so the
        // current attempt is included in the pool.
        const { data: rankData, error: rankErr } = await supabase
          .rpc('get_test_rank', { p_test_id: testId, p_percentage: percentage })
        if (!rankErr && rankData && rankData.length > 0) setRank(rankData[0])
        else if (rankErr) console.error('Rank prediction error:', rankErr)
      } catch (err) {
        console.error('Save result failed:', err)
      } finally {
        setSaving(false)
      }
    } else {
      setPrevAttempts([])
    }

    // Increment free test counter only for non-Pro users
    if (!isPro) {
      const used = safeGet(STORAGE_KEY, 0)
      safeSet(STORAGE_KEY, used + 1)
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function getPerf(pct) {
    if (pct >= 80) return { label: 'Excellent!', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' }
    if (pct >= 60) return { label: 'Good!',      color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/20'  }
    if (pct >= 40) return { label: 'Average',    color: 'text-yellow-600',bg: 'bg-yellow-50 dark:bg-yellow-900/20'}
    return             { label: 'Keep Practicing!', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20'  }
  }

  // Priority 2 helpers
  function pctColorClass(pct) {
    if (pct >= 70) return 'text-green-600'
    if (pct >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }
  function attemptPct(a) {
    if (typeof a.percentage === 'number') return a.percentage
    return a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
  }

  const q        = questions[current]
  const answered = Object.keys(answers).length

  // ── PAYWALL SCREEN ────────────────────────────────────────────────────────
  if (phase === 'paywall') return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <Lock className="h-14 w-14 mx-auto mb-4 text-purple-500" />
          <h2 className="text-xl font-bold mb-2">Free Limit Reached</h2>
          <p className="text-gray-500 text-sm mb-6">{paywallMsg}</p>
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 mb-6">
            <p className="text-3xl font-extrabold text-primary-600 mb-1">Rs.199<span className="text-base font-normal text-gray-400">/month</span></p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 text-left mt-3">
              {['Unlimited mock tests', 'Unlimited Genius AI', 'All 11 AI tools', 'Performance analytics'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/subscribe" className="btn-primary w-full justify-center mb-3">
            Upgrade to Pro
          </Link>
          <button onClick={() => navigate('/mock-tests')} className="btn-secondary w-full justify-center">
            Back to Tests
          </button>
        </div>
      </div>
    </Layout>
  )

  // ── ERROR SCREEN ──────────────────────────────────────────────────────────
  if (phase === 'error') return (
    <Layout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold">Failed to load questions</h2>
        <p className="text-gray-500 text-sm">Please check your internet connection and try again.</p>
        <button onClick={loadQuestions} className="btn-primary">Try Again</button>
      </div>
    </Layout>
  )

  // ── RESUME SCREEN (Priority 2) ────────────────────────────────────────────
  if (phase === 'resume' && savedSession) {
    const answeredCount = Object.keys(savedSession.answers || {}).length
    return (
      <Layout>
        <Helmet><title>Resume Test -- {savedSession.testTitle}</title></Helmet>
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="card p-8 max-w-md w-full text-center">
            <PlayCircle className="h-14 w-14 mx-auto mb-4 text-primary-600" />
            <h2 className="text-xl font-bold mb-1">Resume your test?</h2>
            <p className="text-gray-500 text-sm mb-5">You have an unfinished attempt of<br /><b>{savedSession.testTitle}</b></p>
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xl font-bold">{answeredCount}/{savedSession.questions.length}</p>
                <p className="text-xs text-gray-500">Answered</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xl font-bold">{formatTime(Math.max(0, savedSession.timeLeft || 0))}</p>
                <p className="text-xs text-gray-500">Time Left</p>
              </div>
            </div>
            <button onClick={resumeSavedTest} className="btn-primary w-full justify-center mb-3">
              <PlayCircle className="h-4 w-4" /> Resume Test
            </button>
            <button onClick={startFresh} className="btn-secondary w-full justify-center">
              <RotateCcw className="h-4 w-4" /> Start Fresh
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // ── LOADING SCREEN — skeleton (Priority 2) ────────────────────────────────
  if (phase === 'loading') return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6" aria-busy="true" aria-label="Loading test">
        <div className="card p-4 mb-4 flex items-center justify-between animate-pulse">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full mb-5 animate-pulse" />
        <div className="card p-6 animate-pulse">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-14 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )

  // ── RESULT SCREEN ─────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const perf = getPerf(result.percentage)
    return (
      <Layout>
        <Helmet><title>Test Results -- {testTitle}</title></Helmet>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="card p-8 text-center mb-6">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
            <h1 className="text-2xl font-bold mb-1">Test Completed!</h1>
            <p className="text-gray-500 mb-4">{testTitle}</p>
            {student?.name && <p className="text-primary-600 font-semibold mb-4">Well done, {student.name}!</p>}
            {saving && <p className="text-xs text-gray-400 mb-2">Saving your result...</p>}

            <div className={`inline-block px-6 py-3 rounded-2xl mb-5 ${perf.bg}`}>
              <p className={`text-4xl font-extrabold ${perf.color}`}>{result.percentage}%</p>
              <p className={`font-semibold text-lg ${perf.color}`}>{perf.label}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{result.marksObtained}/{result.maxMarks}</p>
                <p className="text-sm text-gray-500">Marks (-1/3)</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{result.correct}</p>
                <p className="text-sm text-gray-500">Correct (+1)</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{result.wrong}</p>
                <p className="text-sm text-gray-500">Wrong (-1/3)</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
                <p className="text-sm text-gray-500">Skipped (0)</p>
              </div>
            </div>

            <div className="flex justify-center gap-6 text-sm text-gray-500 mb-6">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatTime(result.timeTaken)}</span>
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4" /> Accuracy: {result.accuracy}%</span>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => { setAnswers({}); setCurrent(0); submitted.current = false; setRank(null); setPrevAttempts(null); setReviewFilter('all'); setPhase('loading'); setTimeout(loadQuestions, 100) }}
                className="btn-primary"><RotateCcw className="h-4 w-4" /> Retry</button>
              {result.wrong > 0 && (
                <button onClick={() => { setActiveSection('review'); setReviewFilter('wrong') }} className="btn-secondary">
                  <XCircle className="h-4 w-4 text-red-500" /> Review Wrong ({result.wrong})
                </button>
              )}
              <button onClick={() => navigate('/mock-tests')} className="btn-secondary">More Tests</button>
            </div>
          </div>

          {/* ── Priority 2: Rank prediction + previous attempts ── */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="card p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Medal className="h-4 w-4 text-yellow-500" /> Rank Prediction
              </h3>
              {!user ? (
                <p className="text-sm text-gray-400">
                  <Link to="/login" className="text-primary-600 underline">Sign in</Link> to see your predicted rank and attempt history.
                </p>
              ) : saving && !rank ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              ) : rank && rank.total_attempts > 1 ? (
                <>
                  <p className="text-3xl font-extrabold text-primary-600 mb-1">#{rank.predicted_rank}<span className="text-base font-normal text-gray-400"> of {rank.total_attempts}</span></p>
                  <p className="text-sm text-gray-500">
                    You scored better than or equal to <b className={pctColorClass(rank.percentile)}>{rank.percentile}%</b> of all attempts on this test.
                  </p>
                </>
              ) : rank ? (
                <p className="text-sm text-gray-500">🏁 You're the first to attempt this test — you set the benchmark!</p>
              ) : (
                <p className="text-sm text-gray-400">Rank unavailable right now.</p>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-primary-600" /> Previous Attempts
              </h3>
              {!user ? (
                <p className="text-sm text-gray-400">Sign in to track attempts across sessions.</p>
              ) : prevAttempts === null ? (
                <div className="animate-pulse space-y-2">
                  {[0, 1, 2].map(i => <div key={i} className="h-6 w-full bg-gray-100 dark:bg-gray-800 rounded" />)}
                </div>
              ) : prevAttempts.length === 0 ? (
                <p className="text-sm text-gray-500">🎯 This was your first attempt at this test. Take it again to track improvement!</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const lastPct = attemptPct(prevAttempts[0])
                    const delta = result.percentage - lastPct
                    return (
                      <p className={`text-sm font-semibold flex items-center gap-1 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {delta >= 0 ? '+' : ''}{delta}% vs your last attempt
                      </p>
                    )
                  })()}
                  {prevAttempts.slice(0, 4).map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
                      <span className={`font-bold ${pctColorClass(attemptPct(a))}`}>{attemptPct(a)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Priority 2: personalized next-test recommendation ── */}
          {(() => {
            const weakOrder = Object.entries(result.subjectStats)
              .filter(([, s]) => s.total > 0)
              .map(([name, s]) => ({ name, pct: Math.round((s.correct / s.total) * 100) }))
              .sort((a, b) => a.pct - b.pct)
            const rec = weakOrder.map(w => ({ ...w, recId: SUBJECT_TO_TEST[w.name] }))
              .find(w => w.recId && w.recId !== testId && w.pct < 70)
            if (!rec) return null
            return (
              <div className="card p-5 mb-6 border-2 border-primary-100 dark:border-primary-900/40 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles className="h-8 w-8 text-primary-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Recommended next: {TEST_TITLES[rec.recId]}</p>
                    <p className="text-xs text-gray-500">Your weakest area was <b>{rec.name}</b> ({rec.pct}%) — this test drills it directly.</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/mock-test/start', { state: { testId: rec.recId, title: TEST_TITLES[rec.recId] } })}
                  className="btn-primary text-sm py-2">
                  Start Now <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )
          })()}

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5 gap-1">
            {['analytics', 'review'].map(sec => (
              <button key={sec} onClick={() => setActiveSection(sec)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeSection === sec ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>
                {sec === 'analytics' ? <><BarChart2 className="inline h-4 w-4 mr-1" />Analytics</> : <><CheckCircle className="inline h-4 w-4 mr-1" />Answer Review</>}
              </button>
            ))}
          </div>

          {activeSection === 'analytics' && (
            <div className="space-y-4">
              {(() => {
                // Priority 2: historical subject averages from previous attempts
                const hist = {}
                for (const a of prevAttempts || []) {
                  for (const [subj, s] of Object.entries(a.subject_stats || {})) {
                    if (!hist[subj]) hist[subj] = { c: 0, t: 0 }
                    hist[subj].c += s.correct || 0
                    hist[subj].t += s.total || 0
                  }
                }
                return Object.entries(result.subjectStats).map(([subj, stats]) => {
                  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                  const h = hist[subj]
                  const histPct = h && h.t > 0 ? Math.round((h.c / h.t) * 100) : null
                  const diff = histPct === null ? null : pct - histPct
                  return (
                    <div key={subj} className="card p-5">
                      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                        <span className="font-semibold">{subj}</span>
                        <span className="flex items-center gap-2">
                          {diff !== null && (
                            <span className={`badge text-xs ${diff >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'}`}>
                              {diff >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                              {diff >= 0 ? '+' : ''}{diff}% vs your avg
                            </span>
                          )}
                          <span className={`font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                        <div className={`h-2.5 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span className="text-green-600">{stats.correct} correct</span>
                        <span className="text-red-600">{stats.wrong} wrong</span>
                        <span>{stats.total} total</span>
                      </div>
                      {pct < 50 && (
                        <div className="mt-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 px-3 py-2 rounded-lg">
                          Weak area -- use Genius AI to improve {subj}!
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
              <div className="card p-5 bg-blue-50 dark:bg-blue-900/20">
                <h3 className="font-bold mb-2 text-blue-700 dark:text-blue-300">Recommendation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {result.percentage >= 70
                    ? 'Great! Focus on time management and attempt more sectional tests.'
                    : result.percentage >= 50
                    ? 'Average. Revise weak subjects and practice more previous papers.'
                    : 'Need improvement. Use Genius AI to clarify doubts and create a study plan.'}
                </p>
                <Link to="/genius-ai" className="btn-primary text-sm py-2 inline-flex">Ask Genius AI</Link>
              </div>
            </div>
          )}

          {activeSection === 'review' && (
            <div className="space-y-4">
              {/* Priority 2: review filters */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all',     label: `All (${result.detailedAnswers.length})` },
                  { key: 'wrong',   label: `Wrong (${result.wrong})` },
                  { key: 'skipped', label: `Skipped (${result.skipped})` },
                  { key: 'correct', label: `Correct (${result.correct})` },
                ].map(f => (
                  <button key={f.key} onClick={() => setReviewFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${reviewFilter === f.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {(() => {
                const filtered = result.detailedAnswers
                  .map((a, i) => ({ a, i }))
                  .filter(({ a }) =>
                    reviewFilter === 'all' ? true :
                    reviewFilter === 'wrong' ? (!a.correct && !a.skipped) :
                    reviewFilter === 'skipped' ? a.skipped :
                    a.correct)
                if (filtered.length === 0) return (
                  <div className="card p-8 text-center text-gray-400">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No {reviewFilter} answers in this test{reviewFilter === 'wrong' ? ' — great job!' : '.'}</p>
                  </div>
                )
                return filtered.map(({ a, i }) => (
                <div key={i} className={`card p-5 border-l-4 ${a.correct ? 'border-green-500' : a.skipped ? 'border-gray-400' : 'border-red-500'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    {a.correct
                      ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      : a.skipped
                      ? <MinusCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
                    <p className="font-semibold">Q{i + 1}. {a.question}</p>
                  </div>
                  <div className="pl-7 space-y-1 mb-3">
                    {['A', 'B', 'C', 'D'].map(letter => {
                      const optKey    = `option_${letter.toLowerCase()}`
                      const isCorrect = letter === a.correct_answer
                      const isSelected= letter === a.selected
                      return (
                        <div key={letter} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-700 font-semibold' : isSelected && !isCorrect ? 'bg-red-100 dark:bg-red-900/30 text-red-700' : 'text-gray-500'}`}>
                          <span className="font-bold">{letter}.</span> {a[optKey]}
                          {isCorrect   && <CheckCircle className="h-4 w-4 ml-auto flex-shrink-0" />}
                          {isSelected && !isCorrect && <XCircle className="h-4 w-4 ml-auto flex-shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                  {a.explanation && (
                    <div className="pl-7 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300"><strong>Explanation:</strong> {a.explanation}</p>
                    </div>
                  )}
                </div>
              ))
              })()}
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // ── TEST SCREEN ───────────────────────────────────────────────────────────
  const timeWarning = timeLeft <= 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
    : timeLeft <= 180 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
    : 'bg-green-100 dark:bg-green-900/30 text-green-600'

  return (
    <Layout>
      <Helmet><title>{testTitle} -- Mock Test</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-bold">{testTitle}</p>
            <p className="text-sm text-gray-500">{answered}/{questions.length} answered • -1/3 for wrong</p>
          </div>
          <div className={`flex items-center gap-2 font-bold text-lg px-4 py-2 rounded-xl ${timeWarning}`}>
            <Clock className="h-5 w-5" /> {formatTime(timeLeft)}
          </div>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-5">
          <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>

        {q && (
          <div className="card p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold">Q{current + 1} / {questions.length}</span>
              {q.subject && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{q.subject}</span>}
            </div>
            <h2 className="font-bold text-lg mb-5 leading-relaxed">{q.question}</h2>
            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map(letter => {
                const optKey    = `option_${letter.toLowerCase()}`
                const isSelected= answers[q.id] === letter
                return (
                  <button key={letter} onClick={() => selectAnswer(q.id, letter)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all text-base font-medium ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mr-3 ${isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{letter}</span>
                    {q[optKey]}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
              Click same option again to deselect
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} className="btn-secondary disabled:opacity-40 px-3 sm:px-5">
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Prev</span>
          </button>
          <div className="flex gap-1.5 flex-wrap justify-center max-h-24 overflow-y-auto">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${i === current ? 'bg-primary-600 text-white ring-2 ring-primary-300' : answers[questions[i]?.id] ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          {current === questions.length - 1 ? (
            <button onClick={submitTest} className="btn-primary bg-green-600 hover:bg-green-700 px-3 sm:px-5">
              <span className="hidden sm:inline">Submit</span> <CheckCircle className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} className="btn-primary px-3 sm:px-5">
              <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Layout>
  )
}
