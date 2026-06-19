import { useState, useRef, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import {
  Send, Bot, User, Sparkles, Brain, FileText, Target,
  BookOpen, Mic, MicOff, Volume2, VolumeX, BarChart2,
  Briefcase, MessageSquare, Calendar, TrendingUp,
  ChevronRight, Globe, ArrowRight, RotateCcw, Loader2
} from 'lucide-react'
import { callGroq } from '../../lib/groq'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'chat',         icon: MessageSquare, label: 'Ask Anything',      color: 'text-blue-500',   bg: 'bg-blue-500'   },
  { id: 'mock',         icon: Brain,         label: 'Mock Test',          color: 'text-purple-500', bg: 'bg-purple-500' },
  { id: 'explain',      icon: FileText,      label: 'Explain Answer',     color: 'text-green-500',  bg: 'bg-green-500'  },
  { id: 'studyplan',    icon: Calendar,      label: 'Study Plan',         color: 'text-orange-500', bg: 'bg-orange-500' },
  { id: 'doubt',        icon: MessageSquare, label: 'Solve Doubt',        color: 'text-red-500',    bg: 'bg-red-500'    },
  { id: 'career',       icon: Briefcase,     label: 'Career Roadmap',     color: 'text-yellow-500', bg: 'bg-yellow-500' },
  { id: 'interview',    icon: Target,        label: 'Interview Prep',     color: 'text-indigo-500', bg: 'bg-indigo-500' },
  { id: 'english',      icon: Mic,           label: 'English Practice',   color: 'text-pink-500',   bg: 'bg-pink-500'   },
  { id: 'revision',     icon: BookOpen,      label: 'Revision Plan',      color: 'text-teal-500',   bg: 'bg-teal-500'   },
  { id: 'currentaffairs',icon: TrendingUp,   label: 'Current Affairs',    color: 'text-cyan-500',   bg: 'bg-cyan-500'   },
  { id: 'weakness',     icon: BarChart2,     label: 'Weakness Analyzer',  color: 'text-rose-500',   bg: 'bg-rose-500'   },
]

const WEAKNESS_QUESTIONS = [
  'Which exam are you preparing for?\n(e.g. APPSC Group-2, TSPSC Group-1, DSC, TET, Police...)',
  'Which subjects do you find most difficult?\n(e.g. History, Polity, Maths, Science, Current Affairs...)',
  'How many hours do you study per day?',
  'Have you taken any mock tests? Which topics did you score low in?',
  'What is your biggest challenge while studying?\n(e.g. memory, time management, English medium, understanding concepts...)',
]

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function stripMd(text = '') {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`{1,3}([^`]*)`{1,3}/gs, '$1')
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

function detectScript(text = '') {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-PK'
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'
  
  const lo = text.toLowerCase()
  if (['cheppu','gurinchi','ante','undi','avutundi','cheyyi','meeru','naaku','ikkada','akkada','telugu'].some(w => lo.includes(w))) return 'te-IN'
  if (['batao','bolo','samjhao','hindi mein','kyun','kaise'].some(w => lo.includes(w))) return 'hi-IN'
  return 'en-US'
}

function langOverrideFromKeywords(text = '') {
  const lo = text.toLowerCase()
  if (lo.includes('telugu') && (lo.includes('lo') || lo.includes('cheppu') || lo.includes('report'))) return 'te-IN'
  if (lo.includes('hindi') && (lo.includes('mein') || lo.includes('batao'))) return 'hi-IN'
  return null
}

function langLabel(code) {
  const map = { 
    'te-IN': 'Telugu 🇮🇳', 
    'hi-IN': 'Hindi 🇮🇳', 
    'en-US': 'English', 
    'ur-PK': 'Urdu', 
    'ta-IN': 'Tamil', 
    'ml-IN': 'Malayalam', 
    'kn-IN': 'Kannada' 
  }
  return map[code] || code
}

function buildSystemPrompt(tabId, lang) {
  const langRule = lang && lang !== 'en-US'
    ? `CRITICAL LANGUAGE RULE: The student is using "${lang}". You MUST reply ENTIRELY in that language and script. Telugu -> తెలుగు లిపి. Hindi -> देवनागरी. Never mix languages.`
    : `Detect the student language from their message and reply in the SAME language and script every time.`

  const base = `You are Genius AI 🧠 -- a warm, encouraging personal exam mentor for students preparing for Indian government exams: APPSC, TSPSC, AP Police, TS Police, DSC, TET, RRB, SSC. Be like a knowledgeable friend -- supportive, clear, practical. ${langRule} NEVER use markdown symbols like **, ##, or backticks. Write in plain text only.`

  const extras = {
    explain:      'Explain the given concept or answer clearly with a real-life example. Use analogies Indian students can relate to. Be concise.',
    studyplan:    'Create a practical day-wise study plan. Include subjects, topics, hours, and weekly revision.',
    doubt:        'Answer the student doubt clearly with step-by-step explanation and example.',
    career:       'Give a detailed step-by-step career roadmap with eligibility, timeline, strategy and resources.',
    interview:    'Generate 10 important interview questions for AP/TS government exams with ideal model answers.',
    english:      'Provide English speaking practice exercises with model sentences and tips.',
    revision:     'Create a focused revision plan with topics, time slots and techniques.',
    currentaffairs: 'Give 10 important current affairs points relevant to APPSC/TSPSC exams with clear headings.',
    weakness:     'You are a diagnostic exam mentor. Analyze the student answers and give personalized weakness analysis including: 1. Key weak areas 2. Why they are difficult 3. Actionable strategies 4. 2-week action plan. End with motivation.',
  }

  return base + (extras[tabId] ? '\n\n' + extras[tabId] : '')
}

function getQuickPrompt(tabId) {
  return {
    studyplan: 'Create a detailed 90-day study plan for APPSC Group-2 with daily schedule.',
    career: 'Create a complete career roadmap for becoming an IAS/IPS officer from Andhra Pradesh.',
    interview: 'Generate 10 important APPSC Group-2 interview questions with model answers.',
    english: 'Give me 5 English speaking practice exercises for government job interviews.',
    revision: 'Create a focused 7-day revision plan for APPSC covering History, Polity, Economy, Science & Current Affairs.',
    currentaffairs: "Give me 10 important current affairs for this month relevant to APPSC and TSPSC.",
  }[tabId] || null
}

function getWelcome(tabId) {
  return {
    chat: '👋 Hello! I am Genius AI — your personal APPSC/TSPSC exam mentor!\n\nAsk me anything in Telugu, Hindi or English. I will reply in the same language.',
    mock: '📝 Interactive Mock Test\n\nClick below to start a full mock test with timer and instant feedback.',
    weakness: '📊 Weakness Analyzer\n\nI will ask you 5 quick questions to understand your preparation. Ready?',
  }[tabId] || `Ready to help with ${tabId}! Ask me anything.`
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GeniusAI() {
  const [activeTab, setActiveTab] = useState('chat')
  const [allMessages, setAllMessages] = useState({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [detectedLang, setDetectedLang] = useState(null)
  const [weakStep, setWeakStep] = useState(0)
  const [weakAnswers, setWeakAnswers] = useState([])

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)

  const currentTab = TABS.find(t => t.id === activeTab) || TABS[0]
  const messages = allMessages[activeTab] || [{ role: 'assistant', content: getWelcome(activeTab) }]

  // Load voices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
      const loadVoices = () => {}
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = loadVoices
        synthRef.current.getVoices()
      }
    }
  }, [])

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Cleanup on tab change
  useEffect(() => {
    if (synthRef.current) synthRef.current.cancel()
    setIsSpeaking(false)
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsListening(false)
    setError('')
    inputRef.current?.focus()
  }, [activeTab])

  // ─────────────────────────────────────────────────────────────────────────
  // SPEECH OUTPUT
  // ─────────────────────────────────────────────────────────────────────────
  const speak = useCallback((text, langCode) => {
    if (!voiceOn || !synthRef.current || !text) return

    synthRef.current.cancel()
    const clean = stripMd(text).slice(0, 600)
    if (!clean) return

    const utt = new SpeechSynthesisUtterance(clean)
    const targetLang = langCode || detectedLang || 'en-US'
    utt.lang = targetLang
    utt.rate = 0.92
    utt.pitch = 1.0

    const voices = synthRef.current.getVoices()
    const langPrefix = targetLang.split('-')[0]

    const voice = voices.find(v => v.lang === targetLang) ||
                  voices.find(v => v.lang.startsWith(langPrefix)) ||
                  voices.find(v => v.name.toLowerCase().includes(langPrefix))

    if (voice) utt.voice = voice

    utt.onstart = () => setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utt)
  }, [voiceOn, detectedLang])

  const stopSpeak = () => {
    if (synthRef.current) synthRef.current.cancel()
    setIsSpeaking(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPEECH INPUT
  // ─────────────────────────────────────────────────────────────────────────
  const startListen = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }

    stopSpeak()
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-IN'

    rec.onstart = () => setIsListening(true)
    rec.onerror = (e) => {
      setIsListening(false)
      if (e.error !== 'no-speech') setError('Microphone error: ' + e.error)
    }
    rec.onend = () => setIsListening(false)

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim()
      if (!transcript) return

      const lang = detectScript(transcript)
      setDetectedLang(lang)
      setInput(transcript)
      setTimeout(() => doSend(transcript, lang), 80)
    }

    recognitionRef.current = rec
    rec.start()
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const addMsg = (tabId, msgs) => {
    setAllMessages(prev => ({ ...prev, [tabId]: msgs }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WEAKNESS FLOW
  // ─────────────────────────────────────────────────────────────────────────
  async function handleWeakness(userText, currentLang) {
    const answers = [...weakAnswers, userText]
    setWeakAnswers(answers)

    const base = allMessages['weakness'] || [{ role: 'assistant', content: getWelcome('weakness') }]
    const withUser = [...base, { role: 'user', content: userText }]

    if (weakStep < WEAKNESS_QUESTIONS.length - 1) {
      const nextQ = WEAKNESS_QUESTIONS[weakStep + 1]
      setWeakStep(prev => prev + 1)
      const updated = [...withUser, { role: 'assistant', content: nextQ }]
      addMsg('weakness', updated)
      if (voiceOn) speak(nextQ, currentLang)
    } else {
      addMsg('weakness', withUser)
      setLoading(true)

      const summary = `Student diagnostic answers:\n${answers.map((a, i) => `${i+1}. ${a}`).join('\n')}\n\nGive personalized weakness analysis.`

      try {
        const reply = await callGroq(buildSystemPrompt('weakness', currentLang), [{ role: 'user', content: summary }])
        const clean = stripMd(reply)
        const replyLang = detectScript(clean)
        if (replyLang !== 'en-US') setDetectedLang(replyLang)

        addMsg('weakness', [...withUser, { role: 'assistant', content: clean }])
        if (voiceOn) speak(clean, replyLang)
      } catch (err) {
        setError('AI error: ' + err.message)
        addMsg('weakness', [...withUser, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }])
      }
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN SEND
  // ─────────────────────────────────────────────────────────────────────────
  async function doSend(textArg, langArg) {
    const text = (textArg || input).trim()
    if (!text || loading) return

    setInput('')
    setError('')

    const kwLang = langOverrideFromKeywords(text)
    const scrLang = detectScript(text)
    const finalLang = kwLang || langArg || (scrLang !== 'en-US' ? scrLang : detectedLang) || null
    if (finalLang) setDetectedLang(finalLang)

    if (activeTab === 'mock') {
      window.location.href = '/mock-tests'
      return
    }

    if (activeTab === 'weakness') {
      await handleWeakness(text, finalLang)
      return
    }

    // Normal chat flow
    const base = allMessages[activeTab] || [{ role: 'assistant', content: getWelcome(activeTab) }]
    const withUser = [...base, { role: 'user', content: text }]
    addMsg(activeTab, withUser)
    setLoading(true)

    try {
      const sysPrompt = buildSystemPrompt(activeTab, finalLang)
      const historyToSend = withUser.slice(-10)
      const reply = await callGroq(sysPrompt, historyToSend)
      const clean = stripMd(reply)
      const replyLang = detectScript(clean)

      if (replyLang !== 'en-US') setDetectedLang(replyLang)

      addMsg(activeTab, [...withUser, { role: 'assistant', content: clean }])
      if (voiceOn) speak(clean, replyLang)
    } catch (err) {
      console.error(err)
      const msg = err.message?.includes('API') ? 'API configuration error.' : 'Something went wrong. Please try again.'
      setError(msg)
      addMsg(activeTab, [...withUser, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }

  const switchTab = (id) => {
    setActiveTab(id)
    if (id === 'weakness') {
      setWeakStep(0)
      setWeakAnswers([])
    }
  }

  const resetChat = () => {
    setAllMessages(prev => ({ ...prev, [activeTab]: [{ role: 'assistant', content: getWelcome(activeTab) }] }))
    if (activeTab === 'weakness') {
      setWeakStep(0)
      setWeakAnswers([])
    }
    setError('')
  }

  const quickPrompt = getQuickPrompt(activeTab)

  return (
    <Layout>
      <Helmet>
        <title>Genius AI — Personal Exam Mentor | AP TS Exam Hub</title>
        <meta name="description" content="AI-powered personal exam mentor for APPSC, TSPSC exams. Supports Telugu, Hindi, English." />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-900 via-blue-900 to-primary-700 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Groq — World's Fastest AI
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">Genius AI 🧠</h1>
          <p className="text-blue-200 text-sm">Your Personal APPSC / TSPSC Exam Mentor</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Globe className="h-3.5 w-3.5" />
            {detectedLang ? (
              <span className="font-medium text-primary-600">Language: {langLabel(detectedLang)}</span>
            ) : (
              <span>Type or speak — AI auto-detects</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setVoiceOn(v => !v); if (isSpeaking) stopSpeak() }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all border ${voiceOn ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
            >
              {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {voiceOn ? 'Voice On' : 'Voice Off'}
            </button>
            <button onClick={resetChat} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex gap-2">
            ⚠️ {error}
            <button onClick={() => setError('')} className="ml-auto">✕</button>
          </div>
        )}

        <div className="flex gap-4">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col w-56 flex-shrink-0 gap-1">
            <p className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">AI Tools</p>
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${active ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <Icon className={`h-4 w-4 ${active ? 'text-white' : tab.color}`} />
                  </div>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </aside>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col card overflow-hidden" style={{ height: '620px' }}>
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between bg-white dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${activeTab === 'weakness' ? 'bg-rose-100' : 'bg-purple-100'}`}>
                  <currentTab.icon className={`h-5 w-5 ${currentTab.color}`} />
                </div>
                <div>
                  <h2 className="font-semibold">{currentTab.label}</h2>
                  {activeTab === 'weakness' && weakStep > 0 && (
                    <p className="text-xs text-gray-500">Question {weakStep + 1} of 5</p>
                  )}
                </div>
              </div>
              {isSpeaking && (
                <button onClick={stopSpeak} className="text-purple-600 text-sm flex items-center gap-1">
                  <Volume2 className="h-4 w-4" /> Stop
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50 dark:bg-gray-950">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed ${msg.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}`}>
                      {msg.content}
                    </div>
                    {msg.role === 'assistant' && i > 0 && (
                      <button
                        onClick={() => speak(msg.content)}
                        className="mt-1.5 text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1"
                      >
                        <Volume2 className="h-3 w-3" /> Listen
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-2xl bg-purple-100 flex items-center justify-center">🧠</div>
                  <div className="bg-white dark:bg-gray-800 px-5 py-3 rounded-3xl">Genius AI is thinking...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt */}
            {quickPrompt && activeTab !== 'mock' && activeTab !== 'weakness' && (
              <div className="p-4 border-t bg-white dark:bg-gray-900">
                <button
                  onClick={() => doSend(quickPrompt)}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-medium flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  Generate Now
                </button>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t bg-white dark:bg-gray-900">
              <div className="flex gap-2">
                <button
                  onClick={isListening ? () => {} : startListen}
                  disabled={loading}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  placeholder={isListening ? "Listening... Speak now" : "Type or speak your question..."}
                  className="flex-1 px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />

                <button
                  onClick={() => doSend()}
                  disabled={loading || !input.trim()}
                  className="w-12 h-12 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-2xl flex items-center justify-center transition-all"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}