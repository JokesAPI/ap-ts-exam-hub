import { useState, useRef, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import {
  Send, Sparkles, Brain, FileText, Target,
  BookOpen, Mic, MicOff, Volume2, VolumeX, BarChart2,
  Briefcase, MessageSquare, Calendar, TrendingUp,
  ChevronRight, Globe, ArrowRight, RotateCcw, Loader2
} from 'lucide-react'
import { callGroq } from '../../lib/groq'
import { useAuth } from '../../context/AuthContext'

// ── Free tier limits ─────────────────────────────────────────────────────────
const FREE_MSG_LIMIT = 10  // free messages per day
const MSG_KEY        = 'genius_msgs_v2'
const MSG_DATE_KEY   = 'genius_msgs_date'

function getMsgCount() {
  try {
    const today = new Date().toDateString()
    const saved = localStorage.getItem(MSG_DATE_KEY)
    if (saved !== today) {
      localStorage.setItem(MSG_DATE_KEY, today)
      localStorage.setItem(MSG_KEY, '0')
      return 0
    }
    return parseInt(localStorage.getItem(MSG_KEY) || '0')
  } catch { return 0 }
}

function incMsgCount() {
  try {
    const count = getMsgCount() + 1
    localStorage.setItem(MSG_KEY, String(count))
  } catch {}
}

const TABS = [
  { id: 'chat',          icon: MessageSquare, label: 'Ask Anything',     color: 'text-blue-500'   },
  { id: 'mock',          icon: Brain,         label: 'Mock Test',         color: 'text-purple-500' },
  { id: 'explain',       icon: FileText,      label: 'Explain Answer',    color: 'text-green-500'  },
  { id: 'studyplan',     icon: Calendar,      label: 'Study Plan',        color: 'text-orange-500' },
  { id: 'doubt',         icon: MessageSquare, label: 'Solve Doubt',       color: 'text-red-500'    },
  { id: 'career',        icon: Briefcase,     label: 'Career Roadmap',    color: 'text-yellow-500' },
  { id: 'interview',     icon: Target,        label: 'Interview Prep',    color: 'text-indigo-500' },
  { id: 'english',       icon: Mic,           label: 'English Practice',  color: 'text-pink-500'   },
  { id: 'revision',      icon: BookOpen,      label: 'Revision Plan',     color: 'text-teal-500'   },
  { id: 'currentaffairs',icon: TrendingUp,    label: 'Current Affairs',   color: 'text-cyan-500'   },
  { id: 'weakness',      icon: BarChart2,     label: 'Weakness Analyzer', color: 'text-rose-500'   },
]

const WEAKNESS_QUESTIONS = [
  'Which exam are you preparing for?\n(e.g. APPSC Group-2, TSPSC Group-1, DSC, TET, Police...)',
  'Which subjects do you find most difficult?\n(e.g. History, Polity, Maths, Science, Current Affairs...)',
  'How many hours do you study per day?',
  'Have you taken any mock tests? Which topics did you score low in?',
  'What is your biggest challenge while studying?\n(e.g. memory, time management, English medium, understanding concepts...)',
]

// ── Pure helpers ─────────────────────────────────────────────────────────────
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
  const te = ['cheppu', 'gurinchi', 'ante ', 'undi ', 'avutundi', 'cheyyi',
    'meeru ', 'naaku', 'ikkada', 'akkada', 'ledu', 'ayindi',
    'manchidi', 'chudandi', 'lo cheppu', 'telugu lo']
  if (te.some(w => lo.includes(w))) return 'te-IN'
  const hi = ['batao', 'bolo ', 'karo ', 'mein batao', 'samjhao', 'hindi mein']
  if (hi.some(w => lo.includes(w))) return 'hi-IN'
  return 'en-US'
}

function langOverride(text = '') {
  const lo = text.toLowerCase()
  if (lo.includes('telugu') && (lo.includes('lo') || lo.includes('cheppu') || lo.includes('report') || lo.includes('give'))) return 'te-IN'
  if (lo.includes('hindi') && (lo.includes('mein') || lo.includes('batao') || lo.includes('report') || lo.includes('give'))) return 'hi-IN'
  return null
}

function langLabel(code) {
  const map = { 'te-IN': 'Telugu', 'hi-IN': 'Hindi', 'en-US': 'English', 'ta-IN': 'Tamil', 'ml-IN': 'Malayalam', 'kn-IN': 'Kannada' }
  return map[code] || code
}

function buildSystem(tabId, lang) {
  const langRule = lang && lang !== 'en-US'
    ? 'CRITICAL: You MUST reply ENTIRELY in ' + lang + ' script. Telugu = తెలుగు లిపి. Hindi = देवनागरी. Never use English when language is set.'
    : 'Detect the student language from their message. Reply in the SAME language always.'
  const base = 'You are Genius AI, a warm encouraging exam mentor for APPSC, TSPSC, AP Police, DSC, TET, RRB, SSC students. Be friendly and practical. ' + langRule + ' Never use **, ##, or backtick markdown. Plain text only.'
  const extras = {
    explain:       'Explain the concept clearly with a real-life Indian example. Be concise.',
    studyplan:     'Create a day-wise study plan with subjects, topics, hours per day, and weekly revision.',
    doubt:         'Answer the doubt clearly with a step-by-step explanation and helpful example.',
    career:        'Give a step-by-step career roadmap with eligibility, exam stages, timeline, and preparation tips.',
    interview:     'Generate 10 interview questions for AP/TS government exams with model answers.',
    english:       'Provide English speaking practice with model sentences, interview phrases, and pronunciation tips.',
    revision:      'Create a focused day-wise revision plan with topics, time slots, and practice test schedule.',
    currentaffairs:'Give 10 important current affairs for APPSC/TSPSC. Cover National, AP State, TS State, Economy, Science, Sports, Awards.',
    weakness:      'You are a diagnostic mentor. Student answered 5 questions. Give PERSONALIZED weakness analysis. If student asked in Telugu reply in Telugu script. If Hindi reply in Devanagari. Include: 1. Their 3-5 weak areas. 2. Why each is hard for them. 3. Three strategies per weak area. 4. Two week action plan. 5. Motivational message. Be specific, not generic.',
  }
  return base + (extras[tabId] ? ' ' + extras[tabId] : '')
}

function getQuickPrompt(tabId) {
  const map = {
    studyplan:      'Create a detailed 90-day study plan for APPSC Group-2 with daily schedule and subject-wise time allocation.',
    career:         'Create a complete career roadmap for IAS/IPS from Andhra Pradesh with eligibility, timeline, exam stages, preparation strategy.',
    interview:      'Generate 10 important APPSC Group-2 interview questions with ideal model answers.',
    english:        'Give me 5 English speaking practice exercises for government job interviews with model answers.',
    revision:       'Create a focused 7-day revision plan for APPSC covering History, Polity, AP Economy, General Science, and Current Affairs.',
    currentaffairs: 'Give me 10 important current affairs for this month relevant to APPSC and TSPSC. Cover National, AP State, TS State, Economy, Science, Sports, Awards.',
  }
  return map[tabId] || null
}

function getWelcome(tabId) {
  const map = {
    chat:           '👋 Hello! I am Genius AI -- your personal APPSC/TSPSC exam mentor!\n\nAsk me anything in any language -- Telugu, Hindi, English or any other. I will always reply in the same language!\n\nTry asking:\n"APPSC Group-2 exam pattern explain cheyyi"\n"Current affairs for this month"\n"How to prepare for Polity in 30 days"\n\n🎁 FREE for the first month!',
    mock:           '📝 Interactive Mock Test\n\nClick the button below to start a full interactive mock test with:\nClickable options A/B/C/D\nLive countdown timer\nInstant right/wrong feedback\nScore and answer review\n\n🎁 FREE for first month!',
    currentaffairs: '📰 Current Affairs\n\nClick the button to get this month\'s important current affairs for AP & TS exams!\n\nCovers National, AP State, TS State, Economy, Science, Sports and Awards.',
    weakness:       '📊 Weakness Analyzer\n\nHello! I am your personal exam mentor.\n\nI will ask you 5 quick questions to understand your preparation level. Then I will give you a personalized weakness analysis with exact strategies to improve.\n\nWhich exam are you preparing for?\n(e.g. APPSC Group-2, TSPSC Group-1, DSC, TET, Police...)\n\n🎤 You can type or speak in any language!',
  }
  return map[tabId] || 'Ready to help!\n\nType or speak in Telugu, Hindi, or English.\n\n🎁 FREE for first month!'
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GeniusAI() {
  const { user, isPro } = useAuth()
  const [msgCount,      setMsgCount]      = useState(getMsgCount())
  const [activeTab,    setActiveTab]    = useState('chat')
  const [allMessages,  setAllMessages]  = useState({})
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [isListening,  setIsListening]  = useState(false)
  const [isSpeaking,   setIsSpeaking]   = useState(false)
  const [voiceOn,      setVoiceOn]      = useState(true)
  const [detLang,      setDetLang]      = useState(null)
  const [weakStep,     setWeakStep]     = useState(0)
  const [weakAnswers,  setWeakAnswers]  = useState([])

  // Refs
  const chatEndRef     = useRef(null)
  const inputRef       = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef       = useRef(window.speechSynthesis)
  // Use refs for values needed inside async/callback without stale closure
  const voiceOnRef     = useRef(voiceOn)
  const detLangRef     = useRef(detLang)
  const loadingRef     = useRef(loading)
  const inputValRef    = useRef(input)
  const activeTabRef   = useRef(activeTab)
  const weakStepRef    = useRef(weakStep)
  const weakAnswersRef = useRef(weakAnswers)
  const allMessagesRef = useRef(allMessages)

  // Keep refs in sync
  useEffect(() => { voiceOnRef.current = voiceOn }, [voiceOn])
  useEffect(() => { detLangRef.current = detLang }, [detLang])
  useEffect(() => { loadingRef.current = loading }, [loading])
  useEffect(() => { inputValRef.current = input }, [input])
  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])
  useEffect(() => { weakStepRef.current = weakStep }, [weakStep])
  useEffect(() => { weakAnswersRef.current = weakAnswers }, [weakAnswers])
  useEffect(() => { allMessagesRef.current = allMessages }, [allMessages])

  const currentTab = TABS.find(t => t.id === activeTab)
  const messages   = allMessages[activeTab] || [{ role: 'assistant', content: getWelcome(activeTab) }]

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Cancel on tab switch
  useEffect(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
    recognitionRef.current?.stop()
    setIsListening(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [activeTab])

  // ── speak (uses refs so never stale) ─────────────────────────────────────
  function speakText(text, langCode) {
    if (!voiceOnRef.current || !synthRef.current) return
    synthRef.current.cancel()
    const clean = stripMd(text).slice(0, 600)
    if (!clean) return
    const utt = new SpeechSynthesisUtterance(clean)
    const targetLang = langCode || detLangRef.current || 'en-US'
    utt.lang  = targetLang
    utt.rate  = 0.92
    utt.pitch = 1.0
    // Load voices and find match
    const trySpeak = () => {
      const voices = synthRef.current.getVoices()
      const prefix = targetLang.split('-')[0]
      const match  = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(prefix))
      if (match) utt.voice = match
      utt.onstart = () => setIsSpeaking(true)
      utt.onend   = () => setIsSpeaking(false)
      utt.onerror = () => setIsSpeaking(false)
      synthRef.current.speak(utt)
    }
    // Voices may not be loaded yet
    if (synthRef.current.getVoices().length > 0) {
      trySpeak()
    } else {
      synthRef.current.addEventListener('voiceschanged', trySpeak, { once: true })
    }
  }

  const stopSpeak = () => { synthRef.current?.cancel(); setIsSpeaking(false) }

  // ── addMsg helper ─────────────────────────────────────────────────────────
  function addMsg(tabId, msgs) {
    setAllMessages(prev => ({ ...prev, [tabId]: msgs }))
  }

  // ── Main send (uses refs -- no stale closure) ─────────────────────────────
  async function doSend(textArg, langArg) {
    const text = (textArg !== undefined ? textArg : inputValRef.current).trim()
    if (!text || loadingRef.current) return

    setInput('')
    setError('')

    // Detect language
    const kw = langOverride(text)
    const sc = detectScript(text)
    const finalLang = kw || langArg || (sc !== 'en-US' ? sc : detLangRef.current) || null
    if (finalLang) {
      setDetLang(finalLang)
      detLangRef.current = finalLang
    }

    const tab = activeTabRef.current

    // ── Paywall check ────────────────────────────────────────────────────────
    if (!isPro && msgCount >= FREE_MSG_LIMIT) {
      setError('You have used your ' + FREE_MSG_LIMIT + ' free daily messages. Upgrade to Pro for unlimited access.')
      return
    }

    // Mock tab -- redirect
    if (tab === 'mock') { window.location.href = '/mock-tests'; return }

    // Weakness tab -- mentor flow
    if (tab === 'weakness') {
      await handleWeakness(text, finalLang)
      return
    }

    // Normal chat
    const base     = allMessagesRef.current[tab] || [{ role: 'assistant', content: getWelcome(tab) }]
    const withUser = [...base, { role: 'user', content: text }]
    addMsg(tab, withUser)
    setLoading(true)
    loadingRef.current = true

    try {
      const reply = await callGroq(buildSystem(tab, finalLang), withUser.slice(-10))
      const clean = stripMd(reply)
      // Detect reply language
      const replyLang = detectScript(clean)
      const useLang   = replyLang !== 'en-US' ? replyLang : (finalLang || 'en-US')
      if (replyLang !== 'en-US') { setDetLang(replyLang); detLangRef.current = replyLang }
      addMsg(tab, [...withUser, { role: 'assistant', content: clean }])
      speakText(clean, useLang)
    } catch (err) {
      console.error(err)
      setError(err.message.includes('API') ? 'API key error. Check VITE_GROQ_API_KEY in Vercel settings.' : 'Something went wrong. Please try again.')
      addMsg(tab, [...withUser, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    }

    setLoading(false)
    loadingRef.current = false
  }

  // ── Weakness mentor flow ──────────────────────────────────────────────────
  async function handleWeakness(userText, currentLang) {
    const step    = weakStepRef.current
    const answers = [...weakAnswersRef.current, userText]
    setWeakAnswers(answers)
    weakAnswersRef.current = answers

    const base     = allMessagesRef.current['weakness'] || [{ role: 'assistant', content: getWelcome('weakness') }]
    const withUser = [...base, { role: 'user', content: userText }]

    if (step < WEAKNESS_QUESTIONS.length - 1) {
      const nextQ = WEAKNESS_QUESTIONS[step + 1]
      setWeakStep(step + 1)
      weakStepRef.current = step + 1
      addMsg('weakness', [...withUser, { role: 'assistant', content: nextQ }])
      speakText(nextQ, currentLang)
    } else {
      addMsg('weakness', withUser)
      setLoading(true)
      loadingRef.current = true
      const summary = 'Student answers: Exam=' + (answers[0] || '?') +
        ', Difficult subjects=' + (answers[1] || '?') +
        ', Study hours=' + (answers[2] || '?') +
        ', Mock test performance=' + (answers[3] || '?') +
        ', Biggest challenge=' + (answers[4] || '?') +
        '. Give detailed personalized weakness analysis.'
      try {
        const reply = await callGroq(buildSystem('weakness', currentLang), [{ role: 'user', content: summary }])
        const clean = stripMd(reply)
        const replyLang = detectScript(clean)
        const useLang   = replyLang !== 'en-US' ? replyLang : (currentLang || 'en-US')
        if (replyLang !== 'en-US') { setDetLang(replyLang); detLangRef.current = replyLang }
        addMsg('weakness', [...withUser, { role: 'assistant', content: clean }])
        speakText(clean, useLang)
      } catch (err) {
        setError('AI error: ' + err.message)
      }
      setLoading(false)
      loadingRef.current = false
    }
  }

  // ── Speech input ──────────────────────────────────────────────────────────
  function startListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setError('Speech recognition requires Chrome browser.'); return }
    stopSpeak()
    const rec = new SR()
    rec.continuous     = false
    rec.interimResults = false
    rec.lang           = 'en-IN'
    rec.onstart  = () => setIsListening(true)
    rec.onerror  = e  => { setIsListening(false); if (e.error !== 'no-speech') setError('Mic error: ' + e.error) }
    rec.onend    = ()  => setIsListening(false)
    rec.onresult = e  => {
      const transcript = e.results[0][0].transcript.trim()
      if (!transcript) return
      const lang = detectScript(transcript)
      setDetLang(lang)
      detLangRef.current = lang
      setIsListening(false)
      // Show in input then auto-send
      setInput(transcript)
      inputValRef.current = transcript
      setTimeout(() => doSend(transcript, lang), 150)
    }
    recognitionRef.current = rec
    try { rec.start() } catch (e) { setError('Could not start mic: ' + e.message) }
  }

  function stopListen() { recognitionRef.current?.stop(); setIsListening(false) }

  function switchTab(id) {
    setActiveTab(id)
    setError('')
    if (id === 'weakness') { setWeakStep(0); setWeakAnswers([]); weakStepRef.current = 0; weakAnswersRef.current = [] }
  }

  function resetChat() {
    setAllMessages(prev => ({ ...prev, [activeTab]: [{ role: 'assistant', content: getWelcome(activeTab) }] }))
    if (activeTab === 'weakness') { setWeakStep(0); setWeakAnswers([]); weakStepRef.current = 0; weakAnswersRef.current = [] }
    setError('')
  }

  const quickPrompt = getQuickPrompt(activeTab)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <Helmet>
        <title>Genius AI -- Personal Exam Mentor | AP TS Exam Hub</title>
        <meta name="description" content="AI-powered personal exam mentor for APPSC, TSPSC exams. Supports Telugu, Hindi, English. Free for first month." />
        <meta name="keywords" content="APPSC AI mentor, TSPSC exam help, Telugu AI chatbot, exam preparation AI" />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-blue-900 to-primary-700 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-xs font-semibold mb-3 uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Groq AI
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">Genius AI</h1>
          <p className="text-blue-200 text-sm mb-3">Your Personal APPSC / TSPSC Exam Mentor</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="bg-white/15 px-3 py-1 rounded-full">Any language</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">Voice input</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">Voice output</span>
            <span className="bg-green-500/40 border border-green-400/50 px-3 py-1 rounded-full font-semibold">FREE first month</span>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4">

        {/* Status bar */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Globe className="h-3.5 w-3.5" />
            {!isPro && (
            <div className="flex items-center gap-2 text-xs">
              <span className={msgCount >= FREE_MSG_LIMIT ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                {msgCount}/{FREE_MSG_LIMIT} free msgs today
              </span>
              {msgCount >= FREE_MSG_LIMIT && (
                <a href="/subscribe" className="text-primary-600 font-semibold hover:underline">Upgrade</a>
              )}
            </div>
          )}
          {detLang
              ? <span className="font-medium text-primary-600 dark:text-primary-400">Language: {langLabel(detLang)}</span>
              : <span>Type or speak -- AI auto-detects language</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setVoiceOn(v => !v); voiceOnRef.current = !voiceOnRef.current; if (isSpeaking) stopSpeak() }}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ' + (voiceOn ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300' : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700')}>
              {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {voiceOn ? 'Voice On' : 'Voice Off'}
            </button>
            <button onClick={resetChat} title="Clear chat"
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
            <span>Warning:</span><span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto">X</button>
          </div>
        )}

        {/* Mobile tabs */}
        <div className="md:hidden mb-3 -mx-3 px-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={'flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium min-w-[60px] ' + (active ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] leading-tight text-center">{tab.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-4">

          {/* Desktop sidebar */}
          <aside className="hidden md:flex flex-col w-52 flex-shrink-0 gap-0.5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3 mb-2">AI Tools</p>
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left w-full group ' + (active ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')}>
                  <div className={'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ' + (active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700')}>
                    <Icon className={'h-3.5 w-3.5 ' + (active ? 'text-white' : tab.color)} />
                  </div>
                  <span className="truncate">{tab.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 ml-auto flex-shrink-0 opacity-70" />}
                </button>
              )
            })}
          </aside>

          {/* Chat panel */}
          <div className="flex-1 min-w-0 flex flex-col card overflow-hidden" style={{ height: '600px' }}>

            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2.5">
                <div className={'w-8 h-8 rounded-xl flex items-center justify-center ' + (activeTab === 'weakness' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-purple-100 dark:bg-purple-900/30')}>
                  {(() => { const Icon = currentTab.icon; return <Icon className={'h-4 w-4 ' + currentTab.color} /> })()}
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
                  Free Month
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
              {messages.map((msg, i) => (
                <div key={i} className={'flex gap-2.5 ' + (msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  <div className={'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' + (msg.role === 'assistant' ? 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300' : 'bg-primary-600 text-white')}>
                    {msg.role === 'assistant' ? 'AI' : 'U'}
                  </div>
                  <div className={'max-w-[78%] flex flex-col gap-1 ' + (msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ' + (msg.role === 'assistant' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm border border-gray-100 dark:border-gray-700' : 'bg-primary-600 text-white rounded-tr-sm')}>
                      {msg.content}
                    </div>
                    {msg.role === 'assistant' && i > 0 && (
                      <button onClick={() => speakText(msg.content)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 px-1">
                        <Volume2 className="h-3 w-3" /> Listen
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-xs text-purple-700">AI</div>
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

            {/* Mock quick button */}
            {activeTab === 'mock' && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                <a href="/mock-tests" className="btn-primary text-sm py-2.5 w-full justify-center">
                  <ArrowRight className="h-4 w-4" />
                  Go to Interactive Mock Test
                </a>
              </div>
            )}

            {/* Quick prompt button */}
            {quickPrompt && activeTab !== 'mock' && activeTab !== 'weakness' && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                <button onClick={() => doSend(quickPrompt, detLangRef.current)} disabled={loading}
                  className="btn-primary text-sm py-2.5 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {activeTab === 'studyplan'      && '📅 Generate 90-Day Study Plan'}
                  {activeTab === 'career'         && '🎯 Generate Career Roadmap'}
                  {activeTab === 'interview'      && '💼 Generate Interview Questions'}
                  {activeTab === 'english'        && '🎤 Start English Practice'}
                  {activeTab === 'revision'       && '📚 Create 7-Day Revision Plan'}
                  {activeTab === 'currentaffairs' && '📰 Get This Month Current Affairs'}
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={isListening ? stopListen : startListen}
                  disabled={loading}
                  title={isListening ? 'Stop listening' : 'Speak in any language'}
                  className={'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border disabled:opacity-40 disabled:cursor-not-allowed ' + (isListening ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-400 hover:bg-purple-100')}>
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() } }}
                  disabled={loading}
                  placeholder={isListening ? 'Listening... speak now' : 'Type or speak in Telugu, Hindi, English...'}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60"
                />

                <button onClick={() => doSend()} disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {isListening && (
                <p className="text-xs text-red-500 text-center mt-1.5 animate-pulse font-medium">
                  Listening... speak in Telugu, Hindi or English
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-5 card p-5 sm:p-6 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">After Free Month -- Upgrade to Pro</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">Keep all 11 AI tools unlimited</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                {['Unlimited AI messages', 'All 11 AI tools', 'Telugu + Hindi + English', 'Unlimited mock tests', 'Personalized study plans', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex-shrink-0">
              <p className="text-sm text-gray-400 line-through">Rs.399/month</p>
              <p className="text-5xl font-extrabold text-primary-600">Rs.9</p>
              <p className="text-gray-400 text-sm mb-3">/month after free trial</p>
              <a href="/subscribe" className="btn-primary px-8 py-2.5 inline-flex text-sm">View Plans</a>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
