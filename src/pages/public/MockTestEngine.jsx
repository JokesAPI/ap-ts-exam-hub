import { useState, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useLocation } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { Clock, CheckCircle, XCircle, AlertCircle, Trophy, RotateCcw, ChevronLeft, ChevronRight, MinusCircle, BarChart2, Target, Zap } from 'lucide-react'

const TEST_TIME_PER_Q = 60 // 60 seconds per question

export default function MockTestEngine() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const testId = state?.testId || 'appsc-gs-1'
  const testTitle = state?.title || 'APPSC Mock Test'
  const student = state?.student || {}

  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [phase, setPhase] = useState('loading')
  const [result, setResult] = useState(null)
  const [activeSection, setActiveSection] = useState('review') // review, analytics
  const timerRef = useRef(null)
  const startTime = useRef(Date.now())

  useEffect(() => {
    loadQuestions()
  }, [])

  useEffect(() => {
    if (phase === 'test') {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); submitTest(); return 0 }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [phase])

  async function loadQuestions() {
    const { data, error } = await supabase
      .from('mock_questions')
      .select('*')
      .eq('test_id', testId)
      .limit(10)

    if (error || !data || data.length === 0) {
      // Fallback demo questions
      const demo = Array.from({length: 10}, (_, i) => ({
        id: `demo-${i}`,
        question: `Sample Question ${i+1}: Which of the following is correct about AP/TS government exams?`,
        option_a: 'APPSC conducts Group exams',
        option_b: 'TSPSC is for Telangana',
        option_c: 'Both A and B are correct',
        option_d: 'None of the above',
        correct_answer: 'C',
        explanation: 'Both APPSC (Andhra Pradesh) and TSPSC (Telangana) conduct Group examinations for state government jobs.',
        subject: 'General Studies',
        difficulty: 'easy'
      }))
      setQuestions(demo)
    } else {
      // Shuffle questions
      const shuffled = [...data].sort(() => Math.random() - 0.5)
      setQuestions(shuffled)
    }
    setTimeLeft((data?.length || 10) * TEST_TIME_PER_Q)
    setPhase('test')
    startTime.current = Date.now()
  }

  function selectAnswer(questionId, answer) {
    setAnswers(prev => {
      if (prev[questionId] === answer) {
        // Deselect if same option clicked
        const updated = {...prev}
        delete updated[questionId]
        return updated
      }
      return { ...prev, [questionId]: answer }
    })
  }

  async function submitTest() {
    clearInterval(timerRef.current)
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)

    let correct = 0, wrong = 0, skipped = 0
    const subjectStats = {}

    const detailedAnswers = questions.map(q => {
      const selected = answers[q.id]
      const isCorrect = selected === q.correct_answer
      const isSkipped = !selected

      if (isCorrect) correct++
      else if (isSkipped) skipped++
      else wrong++

      // Subject-wise tracking
      const subj = q.subject || 'General'
      if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, wrong: 0, total: 0 }
      subjectStats[subj].total++
      if (isCorrect) subjectStats[subj].correct++
      else if (!isSkipped) subjectStats[subj].wrong++

      return {
        questionId: q.id,
        question: q.question,
        selected,
        correct_answer: q.correct_answer,
        correct: isCorrect,
        skipped: isSkipped,
        explanation: q.explanation,
        subject: q.subject,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
      }
    })

    // Negative marking: +1 correct, -1/3 wrong, 0 skipped
    const rawScore = correct - (wrong / 3)
    const marksObtained = Math.round(rawScore * 100) / 100
    const maxMarks = questions.length
    const percentage = Math.max(0, Math.round((marksObtained / maxMarks) * 100))
    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0

    const resultData = {
      correct, wrong, skipped,
      marksObtained, maxMarks, percentage, accuracy,
      timeTaken, detailedAnswers, subjectStats,
      total: questions.length
    }

    setResult(resultData)
    setPhase('result')

    // Save to Supabase
    try {
      await supabase.from('mock_results').insert([{
        test_id: testId,
        score: correct,
        total: questions.length,
        time_taken: timeTaken,
        answers: detailedAnswers
      }])
    } catch {}
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function getPerformanceLabel(pct) {
    if (pct >= 80) return { label: '🏆 Excellent!', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' }
    if (pct >= 60) return { label: '👍 Good!', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' }
    if (pct >= 40) return { label: '📚 Average', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' }
    return { label: '💪 Keep Practicing!', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' }
  }

  const q = questions[current]

  // =================== LOADING ===================
  if (phase === 'loading') return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="text-gray-500">Loading questions...</p>
      </div>
    </Layout>
  )

  // =================== RESULT ===================
  if (phase === 'result' && result) {
    const perf = getPerformanceLabel(result.percentage)
    return (
      <Layout>
        <Helmet><title>Test Results — {testTitle}</title></Helmet>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Score card */}
          <div className="card p-8 text-center mb-6">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
            <h1 className="text-2xl font-bold mb-1">Test Completed!</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-5">{testTitle}</p>
            {student?.name && <p className="text-sm text-primary-600 font-medium mb-4">Well done, {student.name}! 🎉</p>}

            <div className={`inline-block px-6 py-3 rounded-2xl mb-5 ${perf.bg}`}>
              <p className={`text-3xl font-extrabold ${perf.color}`}>{result.percentage}%</p>
              <p className={`font-semibold ${perf.color}`}>{perf.label}</p>
            </div>

            {/* Score breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{result.marksObtained}/{result.maxMarks}</p>
                <p className="text-xs text-gray-500">Marks (with -⅓)</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{result.correct}</p>
                <p className="text-xs text-gray-500">Correct (+1)</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{result.wrong}</p>
                <p className="text-xs text-gray-500">Wrong (-⅓)</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
                <p className="text-xs text-gray-500">Skipped (0)</p>
              </div>
            </div>

            {/* Time & Accuracy */}
            <div className="flex justify-center gap-6 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Time: {formatTime(result.timeTaken)}</span>
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4" /> Accuracy: {result.accuracy}%</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Avg: {Math.round(result.timeTaken / result.total)}s/q</span>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => { setAnswers({}); setCurrent(0); setPhase('loading'); loadQuestions() }}
                className="btn-primary"><RotateCcw className="h-4 w-4" /> Retry Test</button>
              <button onClick={() => navigate('/mock-tests')} className="btn-secondary">More Tests</button>
            </div>
          </div>

          {/* Analytics + Review tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5 gap-1">
            <button onClick={() => setActiveSection('analytics')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${activeSection === 'analytics' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>
              <BarChart2 className="h-4 w-4" /> Performance Analytics
            </button>
            <button onClick={() => setActiveSection('review')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${activeSection === 'review' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>
              <CheckCircle className="h-4 w-4" /> Answer Review
            </button>
          </div>

          {/* Analytics */}
          {activeSection === 'analytics' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">Subject-wise Performance</h2>
              {Object.entries(result.subjectStats).map(([subj, stats]) => {
                const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                return (
                  <div key={subj} className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{subj}</span>
                      <span className={`font-bold text-sm ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                      <div className={`h-2.5 rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span className="text-green-600">✓ {stats.correct} correct</span>
                      <span className="text-red-600">✗ {stats.wrong} wrong</span>
                      <span>{stats.total} total</span>
                    </div>
                    {pct < 50 && (
                      <div className="mt-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 px-2.5 py-1.5 rounded-lg">
                        ⚠️ Weak area — focus more on {subj}. Try Genius AI for help!
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="card p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold mb-2 text-blue-700 dark:text-blue-300">🎯 AI Recommendation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {result.percentage >= 70
                    ? 'Great performance! Focus on time management and attempt more sectional tests.'
                    : result.percentage >= 50
                    ? 'Average performance. Revise weak subjects and practice more previous papers.'
                    : 'Need improvement. Start with basics, use Genius AI to clarify doubts and create a study plan.'}
                </p>
                <a href="/genius-ai" className="btn-primary text-sm py-2 inline-flex">Ask Genius AI for Help 🧠</a>
              </div>
            </div>
          )}

          {/* Answer Review */}
          {activeSection === 'review' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">Answer Review</h2>
              {result.detailedAnswers.map((a, i) => (
                <div key={i} className={`card p-5 border-l-4 ${a.correct ? 'border-green-500' : a.skipped ? 'border-gray-400' : 'border-red-500'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    {a.correct ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" /> :
                     a.skipped ? <MinusCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" /> :
                     <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
                    <p className="font-medium text-sm">Q{i+1}. {a.question}</p>
                  </div>

                  {/* Options */}
                  <div className="pl-7 grid grid-cols-1 gap-1 mb-3">
                    {['A', 'B', 'C', 'D'].map(letter => {
                      const optKey = `option_${letter.toLowerCase()}`
                      const isCorrect = letter === a.correct_answer
                      const isSelected = letter === a.selected
                      return (
                        <div key={letter} className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${
                          isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold' :
                          isSelected && !isCorrect ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          'text-gray-500'}`}>
                          <span className="font-bold">{letter}.</span> {a[optKey]}
                          {isCorrect && <CheckCircle className="h-3.5 w-3.5 ml-auto" />}
                          {isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 ml-auto" />}
                        </div>
                      )
                    })}
                  </div>

                  <div className="pl-7 space-y-1">
                    {!a.correct && !a.skipped && <p className="text-xs text-red-600">Your answer: <strong>{a.selected}</strong> (-⅓ mark)</p>}
                    {a.skipped && <p className="text-xs text-gray-500">Skipped (0 marks)</p>}
                    {a.correct && <p className="text-xs text-green-600">Correct! (+1 mark)</p>}
                    {a.explanation && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg mt-1">
                        <p className="text-xs text-blue-700 dark:text-blue-300"><strong>Explanation:</strong> {a.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // =================== TEST ===================
  const answered = Object.keys(answers).length
  const timeWarning = timeLeft <= 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : timeLeft <= 180 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'

  return (
    <Layout>
      <Helmet><title>{testTitle} — AP TS Exam Hub</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-bold text-sm">{testTitle}</p>
            <p className="text-xs text-gray-500">{answered}/{questions.length} answered • ⚠️ -⅓ for wrong</p>
          </div>
          <div className={`flex items-center gap-2 font-bold text-base px-4 py-2 rounded-xl ${timeWarning}`}>
            <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-5">
          <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${(answered / questions.length) * 100}%` }}></div>
        </div>

        {/* Question */}
        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold">
              Q{current + 1} / {questions.length}
            </span>
            {q?.subject && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">{q.subject}</span>}
          </div>
          <h2 className="font-bold text-base mb-5 leading-relaxed">{q?.question}</h2>

          <div className="space-y-3">
            {['A', 'B', 'C', 'D'].map((letter) => {
              const optKey = `option_${letter.toLowerCase()}`
              const isSelected = answers[q?.id] === letter
              return (
                <button key={letter} onClick={() => q && selectAnswer(q.id, letter)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 flex-shrink-0 ${
                    isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>{letter}</span>
                  {q?.[optKey]}
                </button>
              )
            })}
          </div>

          <div className="mt-3 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            💡 Click the same option again to deselect it
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            className="btn-secondary disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>

          <div className="flex gap-1.5 flex-wrap justify-center">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  i === current ? 'bg-primary-600 text-white ring-2 ring-primary-300' :
                  answers[questions[i]?.id] ? 'bg-green-500 text-white' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                {i + 1}
              </button>
            ))}
          </div>

          {current === questions.length - 1 ? (
            <button onClick={submitTest} className="btn-primary bg-green-600 hover:bg-green-700">
              Submit <CheckCircle className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} className="btn-primary">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-gray-500 justify-center">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-primary-600 inline-block"></span>Current</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>Answered</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 inline-block"></span>Not answered</span>
        </div>
      </div>
    </Layout>
  )
}
