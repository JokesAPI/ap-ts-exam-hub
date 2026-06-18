import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { CheckCircle, XCircle, Trophy, RotateCcw, Zap } from 'lucide-react'

const quizData = [
  { q: "Who is the current Chief Minister of Andhra Pradesh?", options: ["Y.S. Jagan Mohan Reddy", "N. Chandrababu Naidu", "K. Chandrashekar Rao", "Pawan Kalyan"], ans: 1, exp: "N. Chandrababu Naidu is the Chief Minister of Andhra Pradesh." },
  { q: "Which river is called the 'Lifeline of Andhra Pradesh'?", options: ["Godavari", "Krishna", "Tungabhadra", "Pennar"], ans: 1, exp: "River Krishna is called the lifeline of Andhra Pradesh." },
  { q: "APPSC stands for?", options: ["Andhra Pradesh Public Service Commission", "AP Police Service Council", "AP Primary School Commission", "None"], ans: 0, exp: "APPSC = Andhra Pradesh Public Service Commission." },
  { q: "Where is the capital of Telangana?", options: ["Visakhapatnam", "Vijayawada", "Hyderabad", "Warangal"], ans: 2, exp: "Hyderabad is the capital of Telangana." },
  { q: "What is the full form of TSPSC?", options: ["TS Police Service Commission", "Telangana State Public Service Commission", "TS Primary School Commission", "None"], ans: 1, exp: "TSPSC = Telangana State Public Service Commission." },
  { q: "Which district is known as the 'Rice Bowl of Andhra Pradesh'?", options: ["Krishna", "Guntur", "East Godavari", "West Godavari"], ans: 3, exp: "West Godavari is known as the Rice Bowl of AP." },
  { q: "Nagarjuna Sagar Dam is built across which river?", options: ["Godavari", "Krishna", "Tungabhadra", "Pennar"], ans: 1, exp: "Nagarjuna Sagar Dam is built across River Krishna." },
  { q: "Which is the largest district of Telangana?", options: ["Hyderabad", "Warangal", "Bhadradri Kothagudem", "Khammam"], ans: 2, exp: "Bhadradri Kothagudem is the largest district in Telangana by area." },
  { q: "AP Grama Sachivalayam was launched in which year?", options: ["2018", "2019", "2020", "2021"], ans: 1, exp: "AP Grama Sachivalayam was launched in 2019 by the AP government." },
  { q: "Which city is known as the 'City of Destiny' in AP?", options: ["Vijayawada", "Guntur", "Visakhapatnam", "Tirupati"], ans: 2, exp: "Visakhapatnam is known as the City of Destiny." },
]

export default function DailyQuiz() {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [answers, setAnswers] = useState([])

  function handleSelect(idx) {
    if (selected !== null) return
    setSelected(idx)
    const correct = idx === quizData[current].ans
    if (correct) setScore(s => s + 1)
    setAnswers(prev => [...prev, { selected: idx, correct }])
  }

  function handleNext() {
    if (current + 1 >= quizData.length) {
      setFinished(true)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
    }
  }

  function handleRestart() {
    setCurrent(0)
    setSelected(null)
    setScore(0)
    setFinished(false)
    setAnswers([])
  }

  const q = quizData[current]
  const percentage = Math.round((score / quizData.length) * 100)

  return (
    <Layout>
      <Helmet>
        <title>Daily GK Quiz - AP TS Exam Hub</title>
        <meta name="description" content="Daily GK Quiz for APPSC TSPSC exam preparation. Free daily quiz for AP and Telangana state exam aspirants." />
      </Helmet>

      <section className="bg-gradient-to-br from-green-800 to-primary-700 text-white py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" /> Free Daily Quiz
          </div>
          <h1 className="text-3xl font-extrabold mb-2">Daily GK Quiz 📝</h1>
          <p className="text-green-100">10 questions daily for APPSC / TSPSC preparation</p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!finished ? (
          <div className="card p-6">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Question {current + 1} of {quizData.length}</span>
              <span className="text-sm font-medium text-green-600">Score: {score}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${((current) / quizData.length) * 100}%` }}></div>
            </div>

            <h2 className="text-lg font-bold mb-5">{q.q}</h2>

            <div className="space-y-3 mb-5">
              {q.options.map((opt, idx) => {
                let cls = 'border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400'
                if (selected !== null) {
                  if (idx === q.ans) cls = 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20'
                  else if (idx === selected) cls = 'border-2 border-red-500 bg-red-50 dark:bg-red-900/20'
                  else cls = 'border-2 border-gray-200 dark:border-gray-700 opacity-60'
                }
                return (
                  <button key={idx} onClick={() => handleSelect(idx)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${cls} ${selected === null ? 'cursor-pointer' : 'cursor-default'}`}>
                    <span className="font-medium mr-2">{['A', 'B', 'C', 'D'][idx]}.</span> {opt}
                    {selected !== null && idx === q.ans && <CheckCircle className="inline ml-2 h-4 w-4 text-green-500" />}
                    {selected !== null && idx === selected && idx !== q.ans && <XCircle className="inline ml-2 h-4 w-4 text-red-500" />}
                  </button>
                )
              })}
            </div>

            {selected !== null && (
              <div className={`p-3 rounded-xl mb-4 text-sm ${selected === q.ans ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                <strong>{selected === q.ans ? '✅ Correct!' : '❌ Wrong!'}</strong> {q.exp}
              </div>
            )}

            {selected !== null && (
              <button onClick={handleNext} className="btn-primary w-full justify-center">
                {current + 1 >= quizData.length ? 'See Results' : 'Next Question →'}
              </button>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-1">Quiz Complete!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Your Results</p>

            <div className="text-6xl font-extrabold mb-2 text-primary-600">{percentage}%</div>
            <p className="text-lg font-semibold mb-6">{score} / {quizData.length} Correct</p>

            <div className={`inline-block px-4 py-2 rounded-full font-semibold mb-6 ${percentage >= 80 ? 'bg-green-100 text-green-700' : percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {percentage >= 80 ? '🏆 Excellent! Keep it up!' : percentage >= 60 ? '👍 Good! Practice more!' : '📚 Need more practice!'}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{score}</p>
                <p className="text-xs text-gray-500">Correct</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{quizData.length - score}</p>
                <p className="text-xs text-gray-500">Wrong</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{quizData.length}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>

            <button onClick={handleRestart} className="btn-primary w-full justify-center mb-3">
              <RotateCcw className="h-4 w-4" /> Try Again
            </button>
            <a href="/genius-ai" className="btn-secondary w-full justify-center">
              Practice with Genius AI 🧠
            </a>
          </div>
        )}
      </div>
    </Layout>
  )
}
