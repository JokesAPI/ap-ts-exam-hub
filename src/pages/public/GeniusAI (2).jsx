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
// PURE HELPERS  (no hooks -- safe to call anywhere)
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
  const te = ['cheppu','gurinchi','ante ','undi ','avutundi','cheyyi','meeru ','naaku','ikkada','akkada','ledu','ayindi','manchidi','chudandi','lo cheppu','telugu lo','telugu mlo']
  if (te.some(w => lo.includes(w))) return 'te-IN'
  const hi = ['batao','bolo ','karo ','mein batao','samjhao','hindi mein','kyun ','kaise ']
  if (hi.some(w => lo.includes(w))) return 'hi-IN'
  return 'en-US'
}

function langOverrideFromKeywords(text = '') {
  const lo = text.toLowerCase()
  const wantTe = lo.includes('telugu') && (lo.includes('lo ') || lo.includes('mlo') || lo.includes('cheppu') || lo.includes('report') || lo.includes('give') || lo.includes('explain') || lo.includes('లో'))
  const wantHi = lo.includes('hindi') && (lo.includes('mein') || lo.includes('report') || lo.includes('batao') || lo.includes('give') || lo.includes('explain'))
  if (wantTe) return 'te-IN'
  if (wantHi) return 'hi-IN'
  return null
}

function langLabel(code) {
  const map = { 'te-IN': 'Telugu 🇮🇳', 'hi-IN': 'Hindi 🇮🇳', 'en-US': 'English', 'ur-PK': 'Urdu', 'ta-IN': 'Tamil', 'ml-IN': 'Malayalam', 'kn-IN': 'Kannada' }
  return map[code] || code
}

function buildSystemPrompt(tabId, lang) {
  const langRule = lang && lang !== 'en-US'
    ? `CRITICAL LANGUAGE RULE: The student is using "${lang}". You MUST reply ENTIRELY in that language and script. Telugu -> తెలుగు లిపి. Hindi -> देवनागरी. Never mix languages. Never switch to English.`
    : `Detect the student's language from their message and reply in the SAME language and script every time.`

  const base = `You are Genius AI 🧠 -- a warm, encouraging personal exam mentor for students preparing for Indian government exams: APPSC, TSPSC, AP Police, TS Police, DSC, TET, RRB, SSC. Be like a knowledgeable friend -- supportive, clear, practical. ${langRule} NEVER use markdown symbols like **, ##, or backticks. Write in plain text only.`

  const extras = {
    explain:      'Explain the given concept or answer clearly with a real-life example. Use analogies Indian students can relate to. Be concise and easy to understand.',
    studyplan:    'Create a practical day-wise study plan. Include: subjects, specific topics, hours per day, weekly revision schedule. Make it realistic and motivating.',
    doubt:        'Answer the student's doubt clearly. Give the correct answer with a step-by-step explanation and a helpful example.',
    career:       'Give a detailed step-by-step career roadmap. Include: eligibility, exam stages, timeline, preparation strategy, important books/resources.',
    interview:    'Generate 10 important interview questions for AP/TS government exams with ideal model answers. Focus on AP/TS history, governance, current affairs.',
    english:      'Provide English speaking practice exercises. Include: model sentences, common interview phrases, pronunciation tips, confidence-building tips.',
    revision:     'Create a focused day-wise revision plan. Include: specific topics per day, time slots, quick-review techniques, practice test schedule.',
    currentaffairs: 'Give 10 important current affairs points relevant to APPSC/TSPSC exams. Cover: National, AP State, TS State, Economy, Science & Tech, Sports, Awards. Use numbered list with clear headings.',
    weakness:     'You are a diagnostic exam mentor. The student has answered 5 diagnostic questions. Now give a PERSONALIZED weakness analysis. LANGUAGE RULE: If student asked in Telugu or says telugu lo cheppu, reply ENTIRELY in Telugu script. If Hindi, reply in Devanagari. Default is English. Analysis must include: 1. Identify their 3-5 specific weak areas. 2. Explain WHY each area is difficult for them. 3. Give 3 actionable improvement strategies per weak area. 4. Create a 2-week action plan. 5. End with a motivational message. Be specific to their answers, NOT generic advice.',
  }

  return base + (extras[tabId] ? '\n\n' + extras[tabId] : '')
}

function getQuickPrompt(tabId) {
  return {
    studyplan:      'Create a detailed 90-day study plan for APPSC Group-2 with daily schedule and subject-wise time allocation.',
    career:         'Create a complete career roadmap for becoming an IAS/IPS officer from Andhra Pradesh -- eligibility, timeline, exam stages, preparation strategy.',
    interview:      'Generate 10 important APPSC Group-2 interview questions with ideal model answers focused on AP/TS governance and history.',
    english:        'Give me 5 English speaking practice exercises for government job interviews with model answers and confidence-building tips.',
    revision:       'Create a focused 7-day revision plan for APPSC covering History, Polity, AP Economy, General Science, and Current Affairs.',
    currentaffairs: 'Give me 10 important current affairs for this month relevant to APPSC and TSPSC. Cover National, AP State, TS State, Economy, Science, Sports, Awards.',
  }[tabId] || null
}

function getWelcome(tabId) {
  return {
    chat:           '👋 Hello! I am Genius AI -- your personal APPSC/TSPSC exam mentor!\n\nAsk me anything in any language -- Telugu, Hindi, English or any other. I will always reply in the same language!\n\n💡 Try asking:\n• "APPSC Group-2 exam pattern explain cheyyi"\n• "Current affairs for this month"\n• "How to prepare for Polity in 30 days"\n\n🎁 FREE for the first month!',
    mock:           '📝 Interactive Mock Test\n\nClick the button below to start a full interactive mock test with:\n✅ Clickable options A/B/C/D\n⏱️ Live timer\n✅ Instant right/wrong feedback\n📊 Score & answer review\n\n🎁 FREE for first month!',
    currentaffairs: '📰 Current Affairs\n\nClick the button to get this month\'s important current affairs for AP & TS exams!\n\nCovers:\n• National News\n• AP State News\n• TS State News\n• Economy & Finance\n• Science & Technology\n• Sports & Awards',
    weakness:       '📊 Weakness Analyzer\n\nHello! I am your personal exam mentor. 👋\n\nI will ask you 5 quick questions to understand your preparation level. Then I will give you a personalized weakness analysis with exact strategies to improve.\n\nLet\'s start!\n\nWhich exam are you preparing for?\n(e.g. APPSC Group-2, TSPSC Group-1, DSC, TET, Police...)\n\n🎤 You can type or speak in any language!',
  }[tabId] || `Ready to help with ${TABS.find(t => t.id === tabId)?.label || 'your preparation'}!\n\nType or speak your question in any language -- Telugu, Hindi, or English.\n\n🎁 FREE for first month!`
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GeniusAI() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState('chat')
  const [allMessages,     setAllMessages]     = useState({})   // { tabId: [{role,content}] }
  const [input,           setInput]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [isListening,     setIsListening]     = useState(false)
  const [isSpeaking,      setIsSpeaking]      = useState(false)
  const [voiceOn,         setVoiceOn]         = useState(true)
  const [detectedLang,    setDetectedLang]    = useState(null)
  const [weakStep,        setWeakStep]        = useState(0)
  const [weakAnswers,     setWeakAnswers]     = useState([])
  const [sidebarOpen,     setSidebarOpen]     = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const chatEndRef    = useRef(null)
  const chatBoxRef    = useRef(null)
  const inputRef      = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef      = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)

  const currentTab = TABS.find(t => t.id === activeTab)
  const messages   = allMessages[activeTab] || [{ role: 'assistant', content: getWelcome(activeTab) }]

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Cancel speech & mic when tab changes ──────────────────────────────────
  useEffect(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
    recognitionRef.current?.stop()
    setIsListening(false)
    setSidebarOpen(false)
    inputRef.current?.focus()
  }, [activeTab])

  // ─────────────────────────────────────────────────────────────────────────
  // SPEECH OUTPUT
  // ─────────────────────────────────────────────────────────────────────────
  const speak = useCallback((text, langCode) => {
    if (!voiceOn || !synthRef.current) return
    synthRef.current.cancel()
    const clean = stripMd(text).slice(0, 600)
    if (!clean) return
    const utt = new SpeechSynthesisUtterance(clean)
    const targetLang = langCode || detectedLang || 'en-US'
    utt.lang  = targetLang
    utt.rate  = 0.92
    utt.pitch = 1.0
    // Try to find a matching voice
    const voices = synthRef.current.getVoices()
    const langPrefix = targetLang.split('-')[0]
    const match = voices.find(v => v.lang === targetLang)
               || voices.find(v => v.lang.startsWith(langPrefix))
    if (match) utt.voice = match
    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    synthRef.current.speak(utt)
  }, [voiceOn, detectedLang])

  const stopSpeak = () => { synthRef.current?.cancel(); setIsSpeaking(false) }

  // ─────────────────────────────────────────────────────────────────────────
  // SPEECH INPUT
  // ─────────────────────────────────────────────────────────────────────────
  const startListen = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setError('Speech recognition requires Chrome browser.'); return }
    stopSpeak()
    const rec = new SR()
    rec.continuous     = false
    rec.interimResults = false
    rec.lang           = detectedLang || 'en-IN'
    rec.onstart  = () => setIsListening(true)
    rec.onerror  = (e) => { setIsListening(false); if (e.error !== 'no-speech') setError('Mic error: ' + e.error) }
    rec.onend    = () => setIsListening(false)
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim()
      if (!transcript) return
      const lang = detectScript(transcript)
      setDetectedLang(lang)
      setIsListening(false)
      // Auto-send immediately after speech
      doSend(transcript, lang)
    }
    recognitionRef.current = rec
    rec.start()
  }, [detectedLang])

  const stopListen = () => { recognitionRef.current?.stop(); setIsListening(false) }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD MESSAGE HELPER
  // ─────────────────────────────────────────────────────────────────────────
  function addMsg(tabId, msgs) {
    setAllMessages(prev => ({ ...prev, [tabId]: msgs }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WEAKNESS FLOW
  // ─────────────────────────────────────────────────────────────────────────
  async function handleWeakness(userText, currentLang) {
    const step    = weakStep
    const answers = [...weakAnswers, userText]
    setWeakAnswers(answers)

    const base    = allMessages['weakness'] || [{ role: 'assistant', content: getWelcome('weakness') }]
    const withUser = [...base, { role: 'user', content: userText }]

    if (step < WEAKNESS_QUESTIONS.length - 1) {
      // Ask next question
      const nextQ = WEAKNESS_QUESTIONS[step + 1]
      setWeakStep(step + 1)
      const updated = [...withUser, { role: 'assistant', content: nextQ }]
      addMsg('weakness', updated)
      if (voiceOn) speak(nextQ, currentLang)
    } else {
      // All 5 answers collected -- send to AI
      addMsg('weakness', withUser)
      setLoading(true)
      const summary = `Student's diagnostic answers:
Exam: ${answers[0] || 'Not specified'}
Difficult subjects: ${answers[1] || 'Not specified'}
Study hours/day: ${answers[2] || 'Not specified'}
Mock test performance: ${answers[3] || 'Not specified'}
Biggest challenge: ${answers[4] || 'Not specified'}

Based on these answers, give a detailed personalized weakness analysis.`
      try {
        const reply = await callGroq(buildSystemPrompt('weakness', currentLang), [{ role: 'user', content: summary }])
        const clean = stripMd(reply)
        const replyLang = detectScript(clean)
        if (replyLang !== 'en-US') setDetectedLang(replyLang)
        addMsg('weakness', [...withUser, { role: 'assistant', content: clean }])
        if (voiceOn) speak(clean, replyLang !== 'en-US' ? replyLang : currentLang)
      } catch (err) {
        setError('AI error: ' + err.message)
        addMsg('weakness', [...withUser, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }])
      }
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN SEND  (called from button, Enter key, speech, quick prompts)
  // ─────────────────────────────────────────────────────────────────────────
  async function doSend(textArg, langArg) {
    const text = (textArg || input).trim()
    if (!text || loading) return
    setInput('')
    setError('')

    // Determine language
    const kwLang   = langOverrideFromKeywords(text)
    const scrLang  = detectScript(text)
    const finalLang = kwLang || langArg || (scrLang !== 'en-US' ? scrLang : detectedLang) || null
    if (finalLang) setDetectedLang(finalLang)

    // Mock Test tab -> go to dedicated page
    if (activeTab === 'mock') {
      window.location.href = '/mock-tests'
      return
    }

    // Weakness tab -> mentor question flow
    if (activeTab === 'weakness') {
      await handleWeakness(text, finalLang)
      return
    }

    // All other tabs -- normal chat
    const base     = allMessages[activeTab] || [{ role: 'assistant', content: getWelcome(activeTab) }]
    const withUser = [...base, { role: 'user', content: text }]
    addMsg(activeTab, withUser)
    setLoading(true)

    try {
      const sysPrompt = buildSystemPrompt(activeTab, finalLang)
      // Only send last 10 messages to avoid token limits
      const historyToSend = withUser.slice(-10)
      const reply = await callGroq(sysPrompt, historyToSend)
      const clean = stripMd(reply)
      const replyLang = detectScript(clean)
      if (replyLang !== 'en-US') setDetectedLang(replyLang)
      const finalLangForSpeech = replyLang !== 'en-US' ? replyLang : finalLang
      addMsg(activeTab, [...withUser, { role: 'assistant', content: clean }])
      if (voiceOn) speak(clean, finalLangForSpeech)
    } catch (err) {
      console.error(err)
      const msg = err.message?.includes('API') ? 'API key error. Check your VITE_GROQ_API_KEY.' : 'Something went wrong. Please try again.'
      setError(msg)
      addMsg(activeTab, [...withUser, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    }
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() }
  }

  function switchTab(id) {
    setActiveTab(id)
    setError('')
    if (id === 'weakness') { setWeakStep(0); setWeakAnswers([]) }
  }

  function resetChat() {
    setAllMessages(prev => ({ ...prev, [activeTab]: [{ role: 'assistant', content: getWelcome(activeTab) }] }))
    if (activeTab === 'weakness') { setWeakStep(0); setWeakAnswers([]) }
    setError('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const quickPrompt = getQuickPrompt(activeTab)

  return (
    <Layout>
      <Helmet>
        <title>Genius AI -- Personal Exam Mentor | AP TS Exam Hub</title>
        <meta name="description" content="AI-powered personal exam mentor for APPSC, TSPSC exams. Supports Telugu, Hindi, English. Free for first month." />
      </Helmet>

      {/* ── HERO ── */}
      <section className="bg-gradient-to-br from-purple-900 via-blue-900 to-primary-700 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-xs font-semibold mb-3 uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Groq -- World's Fastest AI
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">Genius AI 🧠</h1>
          <p className="text-blue-200 text-sm mb-3">Your Personal APPSC / TSPSC Exam Mentor</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="bg-white/15 px-3 py-1 rounded-full">🌐 Any language</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">🎤 Voice input</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">🔊 Voice output</span>
            <span className="bg-green-500/40 border border-green-400/50 px-3 py-1 rounded-full font-semibold">🎁 FREE first month</span>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4">

        {/* ── STATUS BAR ── */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Globe className="h-3.5 w-3.5" />
            {detectedLang
              ? <span className="font-medium text-primary-600 dark:text-primary-400">Language: {langLabel(detectedLang)}</span>
              : <span>Type or speak -- AI auto-detects language</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setVoiceOn(v => !v); if (isSpeaking) stopSpeak() }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${voiceOn ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300' : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}>
              {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {voiceOn ? 'Voice On' : 'Voice Off'}
            </button>
            <button onClick={resetChat}
              title="Clear chat"
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* ── MOBILE TAB STRIP ── */}
        <div className="md:hidden mb-3 -mx-3 px-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all min-w-[60px] ${active ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] leading-tight text-center">{tab.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-4">

          {/* ── DESKTOP SIDEBAR ── */}
          <aside className="hidden md:flex flex-col w-52 flex-shrink-0 gap-0.5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3 mb-2">AI Tools</p>
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full group ${active ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'}`}>
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : tab.color}`} />
                  </div>
                  <span className="truncate">{tab.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 ml-auto flex-shrink-0 opacity-70" />}
                </button>
              )
            })}
          </aside>

          {/* ── CHAT PANEL ── */}
          <div className="flex-1 min-w-0 flex flex-col card overflow-hidden" style={{ height: '600px' }}>

            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'weakness' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                  {(() => { const Icon = currentTab.icon; return <Icon className={`h-4 w-4 ${currentTab.color}`} /> })()}
                </div>
                <div>
                  <h2 className="font-semibold text-sm">{currentTab.label}</h2>
                  {activeTab === 'weakness' && weakStep > 0 && weakStep < WEAKNESS_QUESTIONS.length && (
                    <p className="text-xs text-gray-400">Question {weakStep + 1} of {WEAKNESS_QUESTIONS.length}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <button onClick={stopSpeak}
                    className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 rounded-full animate-pulse font-medium">
                    <Volume2 className="h-3 w-3" /> Stop
                  </button>
                )}
                <span className="text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full font-medium">
                  🎁 Free Month
                </span>
              </div>
            </div>

            {/* Messages area */}
            <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${msg.role === 'assistant' ? 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300' : 'bg-primary-600 text-white'}`}>
                    {msg.role === 'assistant' ? '🧠' : 'U'}
                  </div>
                  {/* Bubble */}
                  <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${msg.role === 'assistant'
                      ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100 dark:border-gray-700'
                      : 'bg-primary-600 text-white rounded-tr-sm'}`}>
                      {msg.content}
                    </div>
                    {/* Listen button on AI messages */}
                    {msg.role === 'assistant' && i > 0 && (
                      <button onClick={() => speak(msg.content)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors px-1">
                        <Volume2 className="h-3 w-3" /> Listen
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-xs">🧠</div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-xs text-gray-400 ml-1">Genius AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ── QUICK ACTION BUTTON ── */}
            {activeTab === 'mock' && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                <a href="/mock-tests"
                  className="btn-primary text-sm py-2.5 w-full justify-center">
                  <ArrowRight className="h-4 w-4" />
                  Go to Interactive Mock Test ->
                </a>
              </div>
            )}

            {quickPrompt && activeTab !== 'mock' && activeTab !== 'weakness' && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                <button onClick={() => doSend(quickPrompt)}
                  disabled={loading}
                  className="btn-primary text-sm py-2.5 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {activeTab === 'studyplan'     && '📅 Generate 90-Day Study Plan'}
                  {activeTab === 'career'        && '🎯 Generate Career Roadmap'}
                  {activeTab === 'interview'     && '💼 Generate Interview Questions'}
                  {activeTab === 'english'       && '🎤 Start English Practice'}
                  {activeTab === 'revision'      && '📚 Create 7-Day Revision Plan'}
                  {activeTab === 'currentaffairs'&& "📰 Get This Month's Current Affairs"}
                </button>
              </div>
            )}

            {/* ── INPUT AREA ── */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
              <div className="flex items-center gap-2">

                {/* Mic button */}
                <button
                  onClick={isListening ? stopListen : startListen}
                  disabled={loading}
                  title={isListening ? 'Stop listening' : 'Speak in any language'}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                    isListening
                      ? 'bg-red-500 border-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                      : 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                {/* Text input */}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  placeholder={
                    isListening
                      ? '🎤 Listening... speak now'
                      : activeTab === 'weakness' && weakStep < WEAKNESS_QUESTIONS.length
                      ? 'Type your answer...'
                      : 'Type or speak in Telugu, Hindi, English...'
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-60"
                />

                {/* Send button */}
                <button
                  onClick={() => doSend()}
                  disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>

              {isListening && (
                <p className="text-xs text-red-500 dark:text-red-400 text-center mt-1.5 animate-pulse font-medium">
                  🎤 Listening... speak in Telugu, Hindi or English
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── PRICING CARD ── */}
        <div className="mt-5 card p-5 sm:p-6 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">After Free Month -- Upgrade to Pro</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">Keep all 11 AI tools unlimited</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                {['Unlimited AI messages', 'All 11 AI tools', 'Telugu + Hindi + English', 'Unlimited mock tests', 'Personalized study plans', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <span className="text-green-500 text-base">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex-shrink-0">
              <p className="text-sm text-gray-400 line-through">₹399/month</p>
              <p className="text-5xl font-extrabold text-primary-600">₹199</p>
              <p className="text-gray-400 text-sm mb-3">/month after free trial</p>
              <a href="/subscribe" className="btn-primary px-8 py-2.5 inline-flex text-sm">
                View Plans
              </a>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
