import { useState, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Clock, CheckCircle, XCircle, AlertCircle, Trophy, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const TEST_TIME = 600 // 10 minutes in seconds

export default function MockTestEngine() {
  const { user, isPro } = useAuth()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(TEST_TIME)
  const [phase, setPhase] = useState('loading') // loading, test, result
  const [result, setResult] = useState(null)
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
    const { data } = await supabase.from('mock_questions').select('*').eq('test_id', 'appsc-gs-1').limit(10)
    if (data && data.length > 0) {
      setQuestions(data)
      setPhase('test')
      startTime.current = Date.now()
    } else {
      toast.error('Could not load questions')
      navigate('/mock-tests')
    }
  }

  function selectAnswer(questionId, answer) {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  async function submitTest() {
    clearInterval(timerRef.current)
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
    let score = 0
    const detailedAnswers = questions.map(q => {
      const selected = answers[q.id]
      const correct = selected === q.correct_answer
      if (correct) score++
      return { questionId: q.id, question: q.question, selected, correct_answer: q.correct_answer, correct, explanation: q.explanation }
    })

    setResult({ score, total: questions.length, timeTaken, detailedAnswers, percentage: Math.round((score / questions.length) * 100) })
    setPhase('result')

    // Save result if logged in
    if (user) {
      await supabase.from('mock_results').insert([{
        user_id: user.id,
        test_id: 'appsc-gs-1',
        score,
        total: questions.length,
        time_taken: timeTaken,
        answers: detailedAnswers
      }])
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const answered = Object.keys(answers).length
  const q = questions[current]

  if (phase === 'loading') return (
    <Layout><div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div></Layout>
  )

  if (phase === 'result') return (
    <Layout>
      <Helmet><title>Test Results - AP TS Exam Hub</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="card p-8 text-center mb-6">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-2xl font-bold mb-1">Test Completed!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">APPSC Group-2 General Studies</p>
          <div className="text-6xl font-extrabold text-primary-600 mb-2">{result.percentage}%</div>
          <p className="text-xl font-semibold mb-2">{result.score} / {result.total} Correct</p>
          <p className="text-gray-400 text-sm mb-6">Time taken: {formatTime(result.timeTaken)}</p>
          <div className={`inline-block px-5 py-2 rounded-full font-semibold text-lg mb-6 ${result.percentage >= 80 ? 'bg-green-100 text-green-700' : result.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {result.percentage >= 80 ? '🏆 Excellent!' : result.percentage >= 60 ? '👍 Good!' : '📚 Keep Practicing!'}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{result.score}</p>
              <p className="text-xs text-gray-500">Correct</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{result.total - result.score}</p>
              <p className="text-xs text-gray-500">Wrong</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{formatTime(result.timeTaken)}</p>
              <p className="text-xs text-gray-500">Time</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setAnswers({}); setCurrent(0); setTimeLeft(TEST_TIME); setPhase('test'); startTime.current = Date.now() }}
              className="btn-primary"><RotateCcw className="h-4 w-4" /> Retry</button>
            <button onClick={() => navigate('/mock-tests')} className="btn-secondary">More Tests</button>
          </div>
        </div>

        {/* Answer review */}
        <h2 className="font-bold text-lg mb-4">Answer Review</h2>
        <div className="space-y-4">
          {result.detailedAnswers.map((a, i) => (
            <div key={i} className={`card p-5 border-l-4 ${a.correct ? 'border-green-500' : 'border-red-500'}`}>
              <div className="flex items-start gap-2 mb-3">
                {a.correct ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
                <p className="font-medium text-sm">Q{i+1}. {a.question}</p>
              </div>
              <div className="pl-7 space-y-1 text-sm">
                {a.selected && <p className={`${a.correct ? 'text-green-600' : 'text-red-600'}`}>Your answer: <strong>{a.selected}</strong></p>}
                {!a.correct && <p className="text-green-600">Correct answer: <strong>{a.correct_answer}</strong></p>}
                {!a.selected && <p className="text-orange-500">Not answered</p>}
                {a.explanation && <p className="text-gray-500 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">{a.explanation}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <Helmet><title>Mock Test - AP TS Exam Hub</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="card p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-bold">APPSC Group-2 General Studies</p>
            <p className="text-sm text-gray-500">{answered}/{questions.length} answered</p>
          </div>
          <div className={`flex items-center gap-2 font-bold text-lg px-4 py-2 rounded-xl ${timeLeft <= 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : timeLeft <= 180 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
            <Clock className="h-5 w-5" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-5">
          <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${(answered / questions.length) * 100}%` }}></div>
        </div>

        {/* Question */}
        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Q{current + 1} of {questions.length}</span>
            {q.subject && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{q.subject}</span>}
          </div>
          <h2 className="font-bold text-lg mb-5">{q.question}</h2>

          <div className="space-y-3">
            {['A', 'B', 'C', 'D'].map((letter, idx) => {
              const optionKey = `option_${letter.toLowerCase()}`
              const optionText = q[optionKey]
              const isSelected = answers[q.id] === letter
              return (
                <button key={letter} onClick={() => selectAnswer(q.id, letter)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm
                    ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {letter}
                  </span>
                  {optionText}
                </button>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            className="btn-secondary disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>

          {/* Question dots */}
          <div className="flex gap-1.5 flex-wrap justify-center">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${i === current ? 'bg-primary-600 text-white' : answers[questions[i]?.id] ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {i + 1}
              </button>
            ))}
          </div>

          {current === questions.length - 1 ? (
            <button onClick={submitTest} className="btn-primary bg-green-600 hover:bg-green-700">
              Submit <CheckCircle className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
              className="btn-primary">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {answered > 0 && answered < questions.length && (
          <div className="mt-4 flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-xl">
            <AlertCircle className="h-4 w-4" />
            {questions.length - answered} questions unanswered
          </div>
        )}
      </div>
    </Layout>
  )
}
