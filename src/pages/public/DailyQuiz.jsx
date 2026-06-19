import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { CheckCircle, XCircle, Trophy, RotateCcw, Zap, ChevronRight } from 'lucide-react'

// Large question bank — 50+ questions
const ALL_QUESTIONS = [
  { q: "Who is the current Chief Minister of Andhra Pradesh (2024-2026)?", options: ["Y.S. Jagan Mohan Reddy", "N. Chandrababu Naidu", "K. Chandrashekar Rao", "Pawan Kalyan"], ans: 1, exp: "N. Chandrababu Naidu of Telugu Desam Party became CM of AP after 2024 elections." },
  { q: "Which river is called the Lifeline of Andhra Pradesh?", options: ["Godavari", "Krishna", "Tungabhadra", "Pennar"], ans: 1, exp: "River Krishna is called the lifeline of Andhra Pradesh due to its major irrigation projects." },
  { q: "APPSC stands for?", options: ["Andhra Pradesh Public Service Commission", "AP Police Service Council", "AP Primary School Commission", "None"], ans: 0, exp: "APPSC = Andhra Pradesh Public Service Commission, established in 1956." },
  { q: "What is the capital of Telangana?", options: ["Visakhapatnam", "Vijayawada", "Hyderabad", "Warangal"], ans: 2, exp: "Hyderabad is the capital of Telangana state." },
  { q: "TSPSC stands for?", options: ["TS Police Service Commission", "Telangana State Public Service Commission", "TS Primary School Commission", "None"], ans: 1, exp: "TSPSC = Telangana State Public Service Commission." },
  { q: "Which district is known as the Rice Bowl of Andhra Pradesh?", options: ["Krishna", "Guntur", "East Godavari", "West Godavari"], ans: 3, exp: "West Godavari is known as the Rice Bowl of AP due to high rice production." },
  { q: "Nagarjuna Sagar Dam is built across which river?", options: ["Godavari", "Krishna", "Tungabhadra", "Pennar"], ans: 1, exp: "Nagarjuna Sagar Dam is built across River Krishna." },
  { q: "Which is the largest district of Telangana by area?", options: ["Hyderabad", "Warangal", "Bhadradri Kothagudem", "Khammam"], ans: 2, exp: "Bhadradri Kothagudem is the largest district in Telangana by area." },
  { q: "AP Grama Sachivalayam was launched in which year?", options: ["2018", "2019", "2020", "2021"], ans: 1, exp: "AP Grama Sachivalayam was launched in 2019 by the AP government." },
  { q: "Which city is known as the City of Destiny in AP?", options: ["Vijayawada", "Guntur", "Visakhapatnam", "Tirupati"], ans: 2, exp: "Visakhapatnam is known as the City of Destiny." },
  { q: "Telangana state was officially formed on which date?", options: ["June 2, 2013", "June 2, 2014", "November 1, 2014", "January 1, 2014"], ans: 1, exp: "Telangana became the 29th state of India on June 2, 2014." },
  { q: "Who was the first Chief Minister of Andhra Pradesh?", options: ["T. Prakasam", "Neelam Sanjeeva Reddy", "B. Gopala Reddy", "Damodaram Sanjivayya"], ans: 1, exp: "Neelam Sanjeeva Reddy became the first CM of AP after its formation on November 1, 1956." },
  { q: "Article 356 of the Indian Constitution deals with?", options: ["Emergency due to war", "Presidents Rule in States", "Financial Emergency", "Fundamental Rights"], ans: 1, exp: "Article 356 provides for imposition of Presidents Rule in a state when constitutional machinery fails." },
  { q: "Who is called the Father of the Indian Constitution?", options: ["Mahatma Gandhi", "Jawaharlal Nehru", "B.R. Ambedkar", "Sardar Patel"], ans: 2, exp: "Dr. B.R. Ambedkar is called the Father of the Indian Constitution as he chaired the Drafting Committee." },
  { q: "GST was implemented in India from which date?", options: ["April 1, 2017", "July 1, 2017", "January 1, 2018", "March 31, 2017"], ans: 1, exp: "Goods and Services Tax (GST) was implemented in India from July 1, 2017." },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Saturn"], ans: 2, exp: "Mars is known as the Red Planet due to iron oxide (rust) on its surface." },
  { q: "What is the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Cell membrane"], ans: 1, exp: "Mitochondria is called the powerhouse of the cell as it produces ATP energy." },
  { q: "NITI Aayog was established in which year?", options: ["2013", "2014", "2015", "2016"], ans: 2, exp: "NITI Aayog was established on January 1, 2015 replacing the Planning Commission." },
  { q: "Charminar was built in which year?", options: ["1491", "1591", "1691", "1791"], ans: 1, exp: "Charminar was built in 1591 by Muhammad Quli Qutb Shah in Hyderabad." },
  { q: "Which river does Srisailam Dam built on?", options: ["Godavari", "Krishna", "Pennar", "Tungabhadra"], ans: 1, exp: "Srisailam Dam is built on River Krishna in Nandyal district, AP." },
  { q: "Which is the highest peak in Andhra Pradesh?", options: ["Arma Konda", "Mahendragiri", "Jindhagada", "Deomali"], ans: 0, exp: "Arma Konda (1680m) in Visakhapatnam district is the highest peak in Andhra Pradesh." },
  { q: "Panchayat Raj was recommended by which committee?", options: ["Balwant Rai Mehta", "Ashok Mehta", "L.M. Singhvi", "Sarkaria"], ans: 0, exp: "Balwant Rai Mehta Committee (1957) recommended the three-tier Panchayati Raj system." },
  { q: "How many Fundamental Rights does Indian Constitution guarantee?", options: ["5", "6", "7", "9"], ans: 1, exp: "Indian Constitution guarantees 6 Fundamental Rights to citizens." },
  { q: "Which gas is most abundant in the Earth atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"], ans: 2, exp: "Nitrogen (N2) makes up about 78% of Earth's atmosphere." },
  { q: "Who was the first CM of Telangana?", options: ["K. Chandrashekar Rao", "T. Harish Rao", "Revanth Reddy", "Owaisi"], ans: 0, exp: "K. Chandrashekar Rao (KCR) of TRS became the first Chief Minister of Telangana on June 2, 2014." },
  { q: "Kakatiya dynasty ruled from which capital?", options: ["Warangal", "Hampi", "Amaravati", "Vengi"], ans: 0, exp: "The Kakatiya dynasty ruled from Warangal (Orugallu) in present-day Telangana." },
  { q: "National Science Day is celebrated on?", options: ["February 28", "March 14", "April 22", "May 11"], ans: 0, exp: "National Science Day is on February 28 commemorating C.V. Raman's discovery of Raman Effect in 1928." },
  { q: "Which bank is called the Bankers Bank of India?", options: ["State Bank of India", "Reserve Bank of India", "NABARD", "SIDBI"], ans: 1, exp: "Reserve Bank of India (RBI) is called the Bankers Bank as it regulates all commercial banks." },
  { q: "Allasani Peddana was court poet of which king?", options: ["Krishnadevaraya", "Prataparudra", "Achyuta Deva Raya", "Bukka Raya"], ans: 0, exp: "Allasani Peddana was Ashtadiggaja court poet of Krishnadevaraya, called Andhra Kavita Pitamaha." },
  { q: "Kaleshwaram Lift Irrigation Project is on which river?", options: ["Krishna", "Godavari", "Manjira", "Pranahita"], ans: 1, exp: "Kaleshwaram LIP is the world's largest multi-stage lift irrigation project on River Godavari." },
  { q: "Which article abolishes untouchability in India?", options: ["Article 14", "Article 15", "Article 17", "Article 21"], ans: 2, exp: "Article 17 of the Indian Constitution abolishes untouchability and forbids its practice." },
  { q: "Pochampally is famous for which craft?", options: ["Kalamkari paintings", "Ikat silk weaving", "Bidriware", "Kondapalli toys"], ans: 1, exp: "Pochampally in Yadadri district is world famous for Ikat silk weaving with GI tag." },
  { q: "Which is the capital of Andhra Pradesh?", options: ["Visakhapatnam", "Vijayawada", "Amaravati", "Guntur"], ans: 2, exp: "Amaravati is the designated capital of AP on the banks of River Krishna." },
  { q: "ISRO headquarters is located in which city?", options: ["Mumbai", "Chennai", "Bengaluru", "Hyderabad"], ans: 2, exp: "ISRO (Indian Space Research Organisation) headquarters is in Bengaluru, Karnataka." },
  { q: "Which sector contributes most to India GDP?", options: ["Agriculture", "Industry", "Services", "Manufacturing"], ans: 2, exp: "Services sector contributes about 55% to India's GDP." },
  { q: "What is the minimum age to become a member of Rajya Sabha?", options: ["21 years", "25 years", "30 years", "35 years"], ans: 2, exp: "The minimum age to become a Rajya Sabha member is 30 years as per Article 84." },
  { q: "Pulicat Lake is located in which district of AP?", options: ["Nellore", "Krishna", "Guntur", "Prakasam"], ans: 0, exp: "Pulicat Lake, India's second largest brackish water lagoon, is in Nellore district, AP." },
  { q: "Gurajada Apparao wrote which famous Telugu play?", options: ["Kanyasulkam", "Malapalli", "Veyi Padagalu", "Mrutyunjaya"], ans: 0, exp: "Kanyasulkam (1892) by Gurajada Apparao is considered the first modern Telugu social reform play." },
  { q: "Which disease is caused by deficiency of Vitamin C?", options: ["Rickets", "Scurvy", "Beriberi", "Night blindness"], ans: 1, exp: "Scurvy is caused by Vitamin C deficiency. Symptoms include bleeding gums and weak immunity." },
  { q: "Amaravati stupa is on the banks of which river?", options: ["Godavari", "Krishna", "Tungabhadra", "Pennar"], ans: 1, exp: "Amaravati Buddhist stupa is on the southern banks of River Krishna in Guntur district." },
  { q: "How many schedules does the Indian Constitution have?", options: ["8", "10", "12", "14"], ans: 2, exp: "The Indian Constitution has 12 schedules after various amendments." },
  { q: "Directive Principles of State Policy borrowed from which country?", options: ["USA", "Ireland", "Canada", "Australia"], ans: 1, exp: "Directive Principles of State Policy were borrowed from the Irish Constitution." },
  { q: "Green Revolution in India is associated with which crop?", options: ["Rice", "Wheat", "Cotton", "Sugarcane"], ans: 1, exp: "Green Revolution (1960s-70s) primarily focused on Wheat using HYV seeds by M.S. Swaminathan." },
  { q: "Golconda Fort is located in which city?", options: ["Warangal", "Hyderabad", "Karimnagar", "Nizamabad"], ans: 1, exp: "Golconda Fort is in Hyderabad, built by Kakatiyas and expanded by Qutb Shahi dynasty." },
  { q: "Which vitamin is produced by skin in sunlight?", options: ["Vitamin A", "Vitamin B12", "Vitamin C", "Vitamin D"], ans: 3, exp: "Vitamin D is synthesized by the skin when exposed to ultraviolet rays from sunlight." },
  { q: "PM Jan Dhan Yojana was launched in which year?", options: ["2012", "2013", "2014", "2015"], ans: 2, exp: "PM Jan Dhan Yojana was launched on August 28, 2014 for financial inclusion." },
  { q: "Which metal is liquid at room temperature?", options: ["Sodium", "Mercury", "Gallium", "Cesium"], ans: 1, exp: "Mercury is the only metal that is liquid at room temperature (25°C)." },
  { q: "73rd Constitutional Amendment relates to?", options: ["Urban local bodies", "Panchayati Raj", "Reservation for OBC", "Right to Education"], ans: 1, exp: "73rd Constitutional Amendment Act 1992 gave constitutional status to Panchayati Raj institutions." },
  { q: "Right to Education is a Fundamental Right under which article?", options: ["Article 19", "Article 21", "Article 21A", "Article 45"], ans: 2, exp: "Article 21A provides the Right to Education for children between 6-14 years." },
  { q: "Kolleru Lake is located between which two rivers?", options: ["Krishna and Godavari", "Godavari and Pennar", "Krishna and Tungabhadra", "Pennar and Palar"], ans: 0, exp: "Kolleru Lake is between the deltas of Krishna and Godavari rivers in AP." },
]

function getDailyQuestions() {
  // Use today's date as seed to get consistent but different questions each day
  const today = new Date().toDateString()
  const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  // Shuffle using seeded random
  const shuffled = [...ALL_QUESTIONS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(((seed * (i + 1)) % 9973) % (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 10)
}

export default function DailyQuiz() {
  const [questions] = useState(getDailyQuestions)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [answers, setAnswers] = useState([])

  function handleSelect(idx) {
    if (selected !== null) return
    setSelected(idx)
    const correct = idx === questions[current].ans
    if (correct) setScore(s => s + 1)
    setAnswers(prev => [...prev, { selected: idx, correct }])
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
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

  const q = questions[current]
  const percentage = Math.round((score / questions.length) * 100)

  return (
    <Layout>
      <Helmet>
        <title>Daily GK Quiz for APPSC TSPSC — AP TS Exam Hub</title>
        <meta name="description" content="Free daily GK quiz for APPSC and TSPSC exam preparation. 10 new questions every day in Telugu and English." />
      </Helmet>

      <section className="bg-gradient-to-br from-green-800 to-primary-700 text-white py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" /> Free Daily Quiz
          </div>
          <h1 className="text-3xl font-extrabold mb-2">Daily GK Quiz 📝</h1>
          <p className="text-green-100">10 new questions every day for APPSC / TSPSC preparation</p>
          <p className="text-green-200 font-telugu text-sm mt-1">ప్రతిరోజూ 10 కొత్త ప్రశ్నలు</p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!finished ? (
          <div className="card p-6">
            {/* Progress */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-gray-600 dark:text-gray-300">Question {current + 1} of {questions.length}</span>
              <span className="text-base font-semibold text-green-600">Score: {score}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
              <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${(current / questions.length) * 100}%` }}></div>
            </div>

            <h2 className="text-lg font-bold mb-5 leading-relaxed">{q.q}</h2>

            <div className="space-y-3 mb-5">
              {q.options.map((opt, idx) => {
                let cls = 'border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 cursor-pointer'
                if (selected !== null) {
                  if (idx === q.ans) cls = 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20 cursor-default'
                  else if (idx === selected) cls = 'border-2 border-red-500 bg-red-50 dark:bg-red-900/20 cursor-default'
                  else cls = 'border-2 border-gray-200 dark:border-gray-700 opacity-50 cursor-default'
                }
                return (
                  <button key={idx} onClick={() => handleSelect(idx)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${cls}`}>
                    <span className="font-bold text-base mr-3">{['A', 'B', 'C', 'D'][idx]}.</span>
                    <span className="text-base">{opt}</span>
                    {selected !== null && idx === q.ans && <CheckCircle className="inline ml-2 h-5 w-5 text-green-500" />}
                    {selected !== null && idx === selected && idx !== q.ans && <XCircle className="inline ml-2 h-5 w-5 text-red-500" />}
                  </button>
                )
              })}
            </div>

            {selected !== null && (
              <div className={`p-4 rounded-xl mb-4 text-sm ${selected === q.ans ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                <strong className="text-base">{selected === q.ans ? '✅ Correct!' : '❌ Wrong!'}</strong>
                <p className="mt-1">{q.exp}</p>
              </div>
            )}

            {selected !== null && (
              <button onClick={handleNext}
                className="btn-primary w-full justify-center py-3 text-base">
                {current + 1 >= questions.length ? 'See Results 🏆' : 'Next Question'} <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-1">Quiz Complete!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Today's Daily Quiz Results</p>

            <div className="text-6xl font-extrabold mb-2 text-primary-600">{percentage}%</div>
            <p className="text-xl font-semibold mb-6">{score} / {questions.length} Correct</p>

            <div className={`inline-block px-5 py-2 rounded-full font-semibold text-lg mb-6 ${percentage >= 80 ? 'bg-green-100 text-green-700' : percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {percentage >= 80 ? '🏆 Excellent! You are well prepared!' : percentage >= 60 ? '👍 Good! Keep practicing!' : '📚 Need more practice!'}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{score}</p>
                <p className="text-sm text-gray-500">Correct</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{questions.length - score}</p>
                <p className="text-sm text-gray-500">Wrong</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-4">New questions available tomorrow!</p>

            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={handleRestart} className="btn-secondary">
                <RotateCcw className="h-4 w-4" /> Retry Today's Quiz
              </button>
              <a href="/mock-tests" className="btn-primary">
                Try Full Mock Test 📋
              </a>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
