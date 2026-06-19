import { useState, useRef, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { Send, Bot, User, Sparkles, Brain, FileText, Target, Clock, Lock, BookOpen, Mic, MicOff, Volume2, VolumeX, BarChart2, Briefcase, MessageSquare, Calendar, TrendingUp, ChevronRight, Globe } from 'lucide-react'
import { callGroq } from '../../lib/groq'

const FREE_LIMIT = 999
const STORAGE_KEY = 'genius_ai_count'
const RESET_KEY = 'genius_ai_date'

// ── Weakness Analyzer mentor questions ──────────────────────────────────────
const WEAKNESS_QUESTIONS = [
  "👋 Hello! I'm your personal exam mentor.\n\nTo analyze your weaknesses accurately, I'll ask you a few quick questions.\n\nFirst: **Which exam are you preparing for?**\n(e.g., APPSC Group-2, TSPSC Group-1, DSC, TET, Police...)",
  "Great! Now tell me — **which subjects do you find most difficult?**\n(e.g., History, Polity, Maths, Science, Current Affairs...)",
  "How many **hours do you study per day** on average?",
  "Have you attempted any **mock tests or previous papers**? If yes, which topics did you score low in?",
  "What is your **biggest challenge** while studying?\n(e.g., memory, time management, English medium, concepts...)",
]

const tabs = [
  { id: 'chat', icon: MessageSquare, label: 'Ask Anything', color: 'text-blue-500' },
  { id: 'mock', icon: Brain, label: 'Mock Test', color: 'text-purple-500' },
  { id: 'explain', icon: FileText, label: 'Explain Answer', color: 'text-green-500' },
  { id: 'studyplan', icon: Calendar, label: 'Study Plan', color: 'text-orange-500' },
  { id: 'doubt', icon: MessageSquare, label: 'Solve Doubt', color: 'text-red-500' },
  { id: 'career', icon: Briefcase, label: 'Career Roadmap', color: 'text-yellow-500' },
  { id: 'interview', icon: Target, label: 'Interview Prep', color: 'text-indigo-500' },
  { id: 'english', icon: Mic, label: 'English Practice', color: 'text-pink-500' },
  { id: 'revision', icon: BookOpen, label: 'Revision Plan', color: 'text-teal-500' },
  { id: 'currentaffairs', icon: TrendingUp, label: 'Current Affairs', color: 'text-cyan-500' },
  { id: 'weakness', icon: BarChart2, label: 'Weakness Analyzer', color: 'text-rose-500' },
]

// ── Strip markdown symbols from AI response ─────────────────────────────────
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')        // italic
    .replace(/#{1,6}\s/g, '')           // headings
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1') // code
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')  // underscore
    .trim()
}

// ── System prompt ────────────────────────────────────────────────────────────
function getSystemPrompt(tabId, detectedLang) {
  const langInstr = detectedLang
    ? `The student is communicating in "${detectedLang}". You MUST reply in the exact same language and script. If they wrote in Telugu, reply in Telugu script. If Hindi, reply in Devanagari. If English, reply in English. Never switch languages unless the student does.`
    : `Auto-detect the student's language from their message and always reply in the same language and script.`

  const base = `You are Genius AI, a warm and encouraging personal exam mentor for students preparing for AP and Telangana state government exams (APPSC, TSPSC, AP Police, TS Police, DSC, TET, RRB, SSC). Speak like a knowledgeable friend and mentor — supportive, clear, and exam-focused. ${langInstr} Never use markdown symbols like **, ##, or backticks in your response.`

  const extras = {
    mock: 'Generate exactly 10 MCQ questions. Format each as:\nQ[N]. [Question]\nA) B) C) D) options\nAnswer: [letter]\nExplanation: [one sentence]\nMake questions relevant to APPSC Group-2 syllabus.',
    explain: 'Explain the concept clearly with a simple example. Use analogies Indian students can relate to. Keep it concise.',
    studyplan: 'Create a practical day-wise study plan with subject names, topics, hours per day, and weekly revision.',
    doubt: 'Answer the doubt clearly with examples. Give the correct answer with explanation.',
    career: 'Give a step-by-step career roadmap with realistic timelines, eligibility, exam stages, and preparation tips.',
    interview: 'Generate 10 interview questions with model answers. Focus on AP/TS history, current affairs, and administration.',
    english: 'Provide English speaking practice with model sentences, common interview phrases, and pronunciation tips.',
    revision: 'Create a day-wise revision schedule with specific topics, time slots, and practice test recommendations.',
    currentaffairs: 'Provide 10 important current affairs for APPSC/TSPSC. Cover National, AP State, TS State, Economy, Science, Sports, Awards. Use numbered list.',
    weakness: `You are a diagnostic exam mentor. The student has answered your questions about their preparation. Now give a PERSONALIZED weakness analysis:
1. Identify their specific weak subjects based on their answers
2. Explain WHY each subject is difficult for them personally
3. Give 3 actionable improvement strategies for each weak area
4. End with a motivational message
Be specific to what they told you — not generic advice.`,
  }

  return base + (extras[tabId] ? '\n\n' + extras[tabId] : '')
}

function getQuickPrompt(tabId) {
  const prompts = {
    mock: 'Generate a 10-question MCQ mock test for APPSC Group-2 General Studies with 4 options, correct answer, and explanation for each question.',
    studyplan: 'Create a detailed 90-day study plan for APPSC Group-2 exam with daily schedule, subject-wise time allocation, and important topics.',
    career: 'Create a complete career roadmap for becoming an IAS/IPS officer from Andhra Pradesh with eligibility, timeline, exam stages, and preparation strategy.',
    interview: 'Generate 10 important APPSC Group-2 interview questions with ideal model answers.',
    english: 'Give me 5 English speaking exercises for government job interviews with model answers and tips to improve spoken English.',
    revision: 'Create a 7-day revision plan for APPSC covering History, Polity, AP Economy, General Science, and Current Affairs with specific topics each day.',
    currentaffairs: 'Give me 10 important current affairs points for this month relevant to APPSC and TSPSC exams. Cover National, AP State, TS State, Economy, Science, Sports, and Awards.',
  }
  return prompts[tabId]
}

function getWelcomeMessage(tabId) {
  const msgs = {
    chat: '👋 Hello! I am Genius AI — your personal APPSC/TSPSC exam mentor!\n\nAsk me anything in any language — Telugu, Hindi, English, or any other language. I will reply in the same language!\n\n• Exam notifications\n• Study tips\n• Current affairs\n• Career guidance\n\n🎁 FREE for the first month — all features unlocked!',
    mock: '📝 Mock Test Generator\n\nClick the button below to get an instant 10-question APPSC mock test with answers and explanations!\n\n🎁 FREE for first month!',
    currentaffairs: '📰 Current Affairs Summarizer\n\nClick below to get this month\'s important current affairs for AP & TS exams!\n\nCovers: National • AP State • TS State • Economy • Science • Sports • Awards',
    weakness: '👋 Hello! I am your personal exam mentor.\n\nTo analyze your weaknesses accurately, I will ask you a few quick questions first.\n\nWhich exam are you preparing for?\n(e.g., APPSC Group-2, TSPSC Group-1, DSC, TET, Police...)\n\n🎤 You can speak or type in any language!',
  }
  return msgs[tabId] || `Ready to help with ${tabs.find(t => t.id === tabId)?.label || ''}!\n\nType or speak your question in any language. I will reply in the same language!\n\n🎁 FREE for first month!`
}

// ── Detect language from speech result ──────────────────────────────────────
function detectLang(text) {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'   // Telugu
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'   // Hindi
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-PK'   // Urdu
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'   // Tamil
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'   // Malayalam
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'   // Kannada
  return 'en-US'
}

export default function GeniusAI() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const [detectedLang, setDetectedLang] = useState(null) // e.g. 'te-IN'
  const [weaknessStep, setWeaknessStep] = useState(0)
  const [weaknessAnswers, setWeaknessAnswers] = useState([])

  const bottomRef = useRef(null)
  const chatRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)

  const currentTab = tabs.find(t => t.id === activeTab)

  const currentMessages = messages[activeTab] || [
    { role: 'assistant', content: getWelcomeMessage(activeTab) }
  ]

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, activeTab, loading])

  // ── Stop speaking when tab changes ───────────────────────────────────────
  useEffect(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
    stopListening()
  }, [activeTab])

  // ── Speech Output ─────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!speechEnabled || !window.speechSynthesis) return
    synthRef.current.cancel()
    const clean = stripMarkdown(text).slice(0, 500) // limit length
    const utt = new SpeechSynthesisUtterance(clean)

    // Pick voice based on detected language
    const voices = synthRef.current.getVoices()
    const langCode = detectedLang || 'en-US'
    const match = voices.find(v => v.lang.startsWith(langCode.split('-')[0]))
    if (match) utt.voice = match
    utt.lang = langCode
    utt.rate = 0.95
    utt.pitch = 1

    utt.onstart = () => setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    synthRef.current.speak(utt)
  }, [speechEnabled, detectedLang])

  const stopSpeaking = () => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }

  // ── Speech Input ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Please use Chrome.')
      return
    }

    stopSpeaking()
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    // Listen in multiple languages by trying auto-detect
    recognition.lang = detectedLang || 'en-IN'

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      const lang = detectLang(transcript)
      setDetectedLang(lang)
      setInput(transcript)
      setIsListening(false)
	  setTimeout(() => sendMessage(transcript), 300)
    }

    recognition.onerror = (e) => {
      setIsListening(false)
      if (e.error !== 'no-speech') setError('Mic error: ' + e.error)
    }

    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
  }, [detectedLang])

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  // ── Weakness Analyzer mentor flow ─────────────────────────────────────────
  async function handleWeaknessFlow(userText) {
    const step = weaknessStep
    const answers = [...weaknessAnswers, userText]
    setWeaknessAnswers(answers)

    if (step < WEAKNESS_QUESTIONS.length - 1) {
      // Still collecting answers — ask next question
      const nextQ = WEAKNESS_QUESTIONS[step + 1]
      setWeaknessStep(step + 1)

      const newUserMsg = { role: 'user', content: userText }
      const nextAiMsg = { role: 'assistant', content: nextQ }
      setMessages(prev => ({
        ...prev,
        weakness: [...(prev.weakness || [{ role: 'assistant', content: getWelcomeMessage('weakness') }]), newUserMsg, nextAiMsg]
      }))
      if (speechEnabled) speak(nextQ)
    } else {
      // All answers collected — send to AI for analysis
      const newUserMsg = { role: 'user', content: userText }
      const history = [
        ...(messages.weakness || [{ role: 'assistant', content: getWelcomeMessage('weakness') }]),
        newUserMsg
      ]
      setMessages(prev => ({ ...prev, weakness: history }))
      setLoading(true)

      const summary = `The student answered my diagnostic questions:
Q1 (Exam): ${answers[0] || ''}
Q2 (Difficult subjects): ${answers[1] || ''}
Q3 (Study hours/day): ${answers[2] || ''}
Q4 (Mock test performance): ${answers[3] || ''}
Q5 (Biggest challenge): ${answers[4] || ''}

Now give a personalized weakness analysis based on these answers.`

      try {
        const systemPrompt = getSystemPrompt('weakness', detectedLang)
        const reply = await callGroq(systemPrompt, [{ role: 'user', content: summary }])
        const clean = stripMarkdown(reply)
        setMessages(prev => ({
          ...prev,
          weakness: [...history, { role: 'assistant', content: clean }]
        }))
        if (speechEnabled) speak(clean)
      } catch (err) {
        setError(`Error: ${err.message}`)
      }
      setLoading(false)
    }
  }

  // ── Main send ─────────────────────────────────────────────────────────────
  async function sendMessage(customPrompt) {
    const userText = customPrompt || input.trim()
    if (!userText) return

    // Detect language from typed text too
    const lang = detectLang(userText)
    if (lang !== 'en-US') setDetectedLang(lang)

    setError('')
    setInput('')

    // Weakness tab uses mentor flow
    if (activeTab === 'weakness' && !customPrompt) {
      await handleWeaknessFlow(userText)
      return
    }

    const newUserMsg = { role: 'user', content: userText }
    const updatedMessages = [...currentMessages, newUserMsg]
    setMessages(prev => ({ ...prev, [activeTab]: updatedMessages }))
    setLoading(true)

    try {
      const systemPrompt = getSystemPrompt(activeTab, detectedLang)
      const reply = await callGroq(systemPrompt, updatedMessages)
      const clean = stripMarkdown(reply)
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: clean }]
      }))
      if (speechEnabled) speak(clean)
    } catch (err) {
      console.error('Genius AI error:', err)
      setError(`Error: ${err.message}. Please check your Groq API key.`)
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` }]
      }))
    }
    setLoading(false)
  }

  function switchTab(tabId) {
    setActiveTab(tabId)
    setError('')
    if (tabId === 'weakness') {
      setWeaknessStep(0)
      setWeaknessAnswers([])
    }
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = 0
    }, 50)
  }

  return (
    <Layout>
      <Helmet>
        <title>Genius AI - Personal Exam Coach | AP TS Exam Hub</title>
        <meta name="description" content="AI exam coach for APPSC TSPSC in any language. Free for first month!" />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-primary-800 to-primary-600 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> Powered by Groq AI — World's Fastest AI
          </div>
          <h1 className="text-3xl font-extrabold mb-1">Genius AI 🧠</h1>
          <p className="text-blue-100 mb-1">Your Personal APPSC / TSPSC Exam Mentor</p>
          <div className="inline-flex items-center gap-2 bg-green-500/30 border border-green-400/50 px-4 py-1.5 rounded-full text-sm font-semibold mt-1">
            🌐 Speaks any language • 🎤 Voice input • 🔊 Voice output
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Language status bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Globe className="h-4 w-4" />
            <span>
              {detectedLang
                ? `Detected: ${detectedLang} — AI will reply in same language`
                : 'Speak or type in any language — AI auto-detects!'}
            </span>
          </div>
          {/* Voice toggle */}
          <button
            onClick={() => { setSpeechEnabled(v => !v); if (isSpeaking) stopSpeaking() }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${speechEnabled ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}
          >
            {speechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {speechEnabled ? 'Voice On' : 'Voice Off'}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Mobile tab strip */}
        <div className="md:hidden mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                  <Icon className="h-4 w-4" />
                  {tab.label.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-5">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex flex-col w-48 flex-shrink-0 gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                  <Icon className={`h-4 w-4 flex-shrink-0 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Chat area */}
          <div className="flex-1 card overflow-hidden flex flex-col" style={{ height: '560px' }}>
            {/* Tab header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {(() => { const Icon = currentTab.icon; return <Icon className={`h-5 w-5 ${currentTab.color}`} /> })()}
                <h2 className="font-semibold">{currentTab.label}</h2>
                {activeTab === 'weakness' && weaknessStep > 0 && weaknessStep < WEAKNESS_QUESTIONS.length && (
                  <span className="text-xs text-gray-400 ml-1">Question {weaknessStep}/{WEAKNESS_QUESTIONS.length}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <button onClick={stopSpeaking}
                    className="text-xs text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full animate-pulse">
                    🔊 Stop
                  </button>
                )}
                <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                  🎁 Free Month
                </span>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'assistant' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
                    {m.role === 'assistant' ? <Bot className="h-4 w-4 text-purple-600" /> : <User className="h-4 w-4 text-primary-600" />}
                  </div>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100' : 'bg-primary-600 text-white'}`}>
                    {m.content}
                    {/* Speak button on AI messages */}
                    {m.role === 'assistant' && i > 0 && (
                      <button onClick={() => speak(m.content)}
                        className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-purple-500 transition-colors">
                        <Volume2 className="h-3 w-3" /> Listen
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-600 animate-pulse" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl">
                    <div className="flex gap-1 items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      <span className="text-xs text-gray-400 ml-2">Genius AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick action button — not shown for weakness (mentor flow handles it) */}
            {getQuickPrompt(activeTab) && activeTab !== 'weakness' && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                <button onClick={() => sendMessage(getQuickPrompt(activeTab))}
                  disabled={loading}
                  className="btn-primary text-sm py-2 disabled:opacity-50 w-full justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                  {activeTab === 'mock' && '📝 Generate Mock Test Now'}
                  {activeTab === 'studyplan' && '📅 Generate 90-Day Study Plan'}
                  {activeTab === 'career' && '🎯 Generate Career Roadmap'}
                  {activeTab === 'interview' && '💼 Generate Interview Questions'}
                  {activeTab === 'english' && '🎤 Start English Practice'}
                  {activeTab === 'revision' && '📚 Create 7-Day Revision Plan'}
                  {activeTab === 'currentaffairs' && "📰 Get Today's Current Affairs"}
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                {/* Mic button */}
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={loading}
                  title={isListening ? 'Stop listening' : 'Speak in any language'}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 ${isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200'
                    }`}>
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                <input
                  className="input flex-1 text-sm"
                  placeholder={isListening ? '🎤 Listening... speak now' : 'Type or speak in any language...'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !loading && sendMessage()}
                  disabled={loading}
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  className="btn-primary px-4 disabled:opacity-50 flex-shrink-0">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {isListening && (
                <p className="text-xs text-red-500 mt-1 text-center animate-pulse">
                  🎤 Listening... speak in Telugu, Hindi, English or any language
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing card */}
        <div className="mt-6 card p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div>
              <h3 className="text-xl font-bold mb-1">After Free Month — Upgrade to Pro</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">Continue enjoying all 11 AI tools after the free period</p>
              <ul className="grid grid-cols-2 gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                {['Unlimited AI messages', 'All 11 AI sections', 'Any language support', 'Unlimited mock tests', 'Personalized study plans', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex-shrink-0">
              <p className="text-sm text-gray-400 line-through">₹399</p>
              <p className="text-4xl font-extrabold text-primary-600">₹199</p>
              <p className="text-gray-400 text-sm mb-3">/month after free trial</p>
              <a href="/subscribe" className="btn-primary px-8 py-3 inline-flex">
                View Plans
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
