import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { Send, Bot, User, Sparkles, Brain, FileText, Target, Clock, Lock, BookOpen, Mic, BarChart2, Briefcase, MessageSquare, Calendar, TrendingUp, ChevronRight, Globe } from 'lucide-react'
import { callGroq } from '../../lib/groq'

const FREE_LIMIT = 999 // Free for first month
const STORAGE_KEY = 'genius_ai_count'
const RESET_KEY = 'genius_ai_date'

const LANGUAGES = [
  { code: 'english', label: 'English', flag: '🇬🇧' },
  { code: 'telugu', label: 'తెలుగు', flag: '🏴' },
  { code: 'hindi', label: 'हिंदी', flag: '🇮🇳' },
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

function getLangInstruction(lang) {
  if (lang === 'telugu') return 'IMPORTANT: You MUST reply ONLY in Telugu language using Telugu script (తెలుగు లిపి). Do not use English words except for proper nouns and exam terms.'
  if (lang === 'hindi') return 'IMPORTANT: You MUST reply ONLY in Hindi language using Devanagari script (हिंदी). Do not use English words except for proper nouns and exam terms.'
  return 'Reply in clear, simple English.'
}

function getSystemPrompt(tabId, lang) {
  const langInstr = getLangInstruction(lang)
  const base = `You are Genius AI, a helpful and encouraging personal exam coach for students preparing for AP and Telangana state government exams in India. You specialize in APPSC, TSPSC, AP Police, TS Police, DSC, TET, RRB, SSC exams. Always be positive, clear and exam-focused. ${langInstr}`

  const extras = {
    mock: 'Generate exactly 10 MCQ questions. Format each as:\nQ[N]. [Question text]\nA) [option]\nB) [option]\nC) [option]\nD) [option]\nAnswer: [letter]\nExplanation: [one sentence]\n\nMake questions relevant to APPSC Group-2 syllabus.',
    explain: 'Explain the given concept or question clearly with a simple example. Use analogies that Indian students can relate to. Keep it concise.',
    studyplan: 'Create a practical, day-wise study plan. Include subject names, topics, hours per day, and weekly revision. Be specific.',
    doubt: 'Answer the doubt clearly with examples. If it is a factual question, give the correct answer with explanation.',
    career: 'Give a step-by-step career roadmap with realistic timelines, eligibility criteria, exam stages, and preparation tips.',
    interview: 'Generate 10 interview questions with model answers. Focus on AP/TS history, current affairs, and general administration.',
    english: 'Provide English speaking practice exercises with model sentences, common interview phrases, and pronunciation tips.',
    revision: 'Create a day-wise revision schedule with specific topics, time slots, and practice test recommendations.',
    currentaffairs: 'Provide 10 important current affairs points relevant to APPSC/TSPSC exams. Include National, AP State, TS State, Economy, Science, Sports, and Awards. Format as numbered list with bold headings.',
    weakness: 'Identify the top 5 common weak areas for APPSC aspirants. For each, explain why it is difficult and give 3 specific improvement strategies.',
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
    weakness: 'Analyze the top 5 weak subjects where APPSC aspirants struggle most, explain why, and give 3 specific strategies to improve each subject.',
  }
  return prompts[tabId]
}

function getWelcomeMessage(tabId, lang) {
  const msgs = {
    chat: {
      english: '👋 Hello! I am Genius AI — your personal APPSC/TSPSC exam coach!\n\nAsk me anything:\n• Exam notifications\n• Study tips\n• Current affairs\n• Career guidance\n\n🎁 FREE for the first month — all features unlocked!',
      telugu: '👋 నమస్కారం! నేను Genius AI — మీ వ్యక్తిగత పరీక్ష కోచ్!\n\nఏదైనా అడగండి:\n• పరీక్ష నోటిఫికేషన్లు\n• చదువు చిట్కాలు\n• కరెంట్ అఫైర్స్\n\n🎁 మొదటి నెల పూర్తిగా FREE!',
      hindi: '👋 नमस्ते! मैं Genius AI हूं — आपका व्यक्तिगत परीक्षा कोच!\n\nकुछ भी पूछें:\n• परीक्षा सूचनाएं\n• पढ़ाई के टिप्स\n• करंट अफेयर्स\n\n🎁 पहले महीने बिल्कुल FREE!',
    },
    mock: {
      english: '📝 Mock Test Generator\n\nClick the button below to get instant 10-question APPSC mock test with answers and explanations!\n\n🎁 FREE for first month!',
      telugu: '📝 మాక్ టెస్ట్ జనరేటర్\n\nత్వరిత 10-ప్రశ్నల APPSC మాక్ టెస్ట్ కోసం దిగువ బటన్ నొక్కండి!\n\n🎁 మొదటి నెల FREE!',
      hindi: '📝 मॉक टेस्ट जनरेटर\n\nत्वरित 10-प्रश्न APPSC मॉक टेस्ट के लिए नीचे बटन दबाएं!\n\n🎁 पहले महीने FREE!',
    },
    currentaffairs: {
      english: '📰 Current Affairs Summarizer\n\nClick below to get this month\'s important current affairs for AP & TS exams!\n\nCovers: National • AP State • TS State • Economy • Science • Sports • Awards',
      telugu: '📰 కరెంట్ అఫైర్స్ సమ్మరీ\n\nAP & TS పరీక్షలకు ఈ నెల ముఖ్యమైన కరెంట్ అఫైర్స్ పొందడానికి దిగువ నొక్కండి!',
      hindi: '📰 करंट अफेयर्स सारांश\n\nAP & TS परीक्षाओं के लिए इस महीने के महत्वपूर्ण करंट अफेयर्स पाने के लिए नीचे दबाएं!',
    },
  }
  const defaultMsg = {
    english: `Ready to help with ${tabs.find(t => t.id === tabId)?.label || ''}!\n\nType your question below or click the button. 🎁 FREE for first month!`,
    telugu: `${tabs.find(t => t.id === tabId)?.label || ''} కోసం సిద్ధంగా ఉన్నాను!\n\nదిగువ మీ ప్రశ్న టైప్ చేయండి. 🎁 మొదటి నెల FREE!`,
    hindi: `${tabs.find(t => t.id === tabId)?.label || ''} के लिए तैयार हूं!\n\nनीचे अपना प्रश्न टाइप करें। 🎁 पहले महीने FREE!`,
  }
  return (msgs[tabId] || defaultMsg)[lang] || (msgs[tabId] || defaultMsg)['english']
}

export default function GeniusAI() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('english')
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const chatRef = useRef(null)
  const currentTab = tabs.find(t => t.id === activeTab)

  useEffect(() => {
    setMessages({})
  }, [language])

  useEffect(() => {
    // Scroll chat area to bottom, not the whole page
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, activeTab, loading])

  const currentMessages = messages[activeTab] || [
    { role: 'assistant', content: getWelcomeMessage(activeTab, language) }
  ]

  async function sendMessage(customPrompt) {
    const userText = customPrompt || input.trim()
    if (!userText) return

    setError('')
    const newUserMsg = { role: 'user', content: userText }
    const updatedMessages = [...currentMessages, newUserMsg]
    setMessages(prev => ({ ...prev, [activeTab]: updatedMessages }))
    setInput('')
    setLoading(true)

    try {
      const systemPrompt = getSystemPrompt(activeTab, language)
      const reply = await callGroq(systemPrompt, updatedMessages)
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: reply }]
      }))
    } catch (err) {
      console.error('Genius AI error:', err)
      setError(`Error: ${err.message}. Please check your Groq API key in .env file.`)
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}\n\nPlease make sure VITE_GROQ_API_KEY is set correctly in your .env file and Vercel environment variables.` }]
      }))
    }
    setLoading(false)
  }

  function switchTab(tabId) {
    setActiveTab(tabId)
    setError('')
    // Scroll chat to top when switching tabs
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = 0
    }, 50)
  }

  return (
    <Layout>
      <Helmet>
        <title>Genius AI - Personal Exam Coach | AP TS Exam Hub</title>
        <meta name="description" content="AI exam coach for APPSC TSPSC in Telugu, Hindi and English. Free for first month!" />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-primary-800 to-primary-600 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> Powered by Groq AI — World's Fastest AI
          </div>
          <h1 className="text-3xl font-extrabold mb-1">Genius AI 🧠</h1>
          <p className="text-blue-100 mb-1">Your Personal APPSC / TSPSC Exam Coach</p>
          <div className="inline-flex items-center gap-2 bg-green-500/30 border border-green-400/50 px-4 py-1.5 rounded-full text-sm font-semibold mt-1">
            🎁 FREE for first month — All features unlocked!
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Language selector */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500 font-medium">Language:</span>
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => setLanguage(lang.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${language === lang.code ? 'bg-primary-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
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
          <div className="flex-1 card overflow-hidden flex flex-col" style={{height: '560px'}}>
            {/* Tab header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {(() => { const Icon = currentTab.icon; return <Icon className={`h-5 w-5 ${currentTab.color}`} /> })()}
                <h2 className="font-semibold">{currentTab.label}</h2>
              </div>
              <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                🎁 Free Month
              </span>
            </div>

            {/* Messages - scrollable area */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'assistant' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
                    {m.role === 'assistant' ? <Bot className="h-4 w-4 text-purple-600" /> : <User className="h-4 w-4 text-primary-600" />}
                  </div>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100' : 'bg-primary-600 text-white'}`}>
                    {m.content}
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
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
                      <span className="text-xs text-gray-400 ml-2">Genius AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick action button */}
            {getQuickPrompt(activeTab) && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                <button onClick={() => sendMessage(getQuickPrompt(activeTab))}
                  disabled={loading}
                  className="btn-primary text-sm py-2 disabled:opacity-50 w-full justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                  {activeTab === 'mock' && (language === 'telugu' ? '📝 మాక్ టెస్ట్ జనరేట్ చేయి' : language === 'hindi' ? '📝 मॉक टेस्ट जनरेट करें' : '📝 Generate Mock Test Now')}
                  {activeTab === 'studyplan' && (language === 'telugu' ? '📅 స్టడీ ప్లాన్ తయారు చేయి' : language === 'hindi' ? '📅 स्टडी प्लान बनाएं' : '📅 Generate 90-Day Study Plan')}
                  {activeTab === 'career' && (language === 'telugu' ? '🎯 కెరీర్ రోడ్‌మ్యాప్ పొందు' : language === 'hindi' ? '🎯 करियर रोडमैप पाएं' : '🎯 Generate Career Roadmap')}
                  {activeTab === 'interview' && (language === 'telugu' ? '💼 ఇంటర్వ్యూ ప్రశ్నలు పొందు' : language === 'hindi' ? '💼 इंटरव्यू प्रश्न पाएं' : '💼 Generate Interview Questions')}
                  {activeTab === 'english' && (language === 'telugu' ? '🎤 ఇంగ్లీష్ ప్రాక్టీస్ ప్రారంభించు' : language === 'hindi' ? '🎤 अंग्रेजी अभ्यास शुरू करें' : '🎤 Start English Practice')}
                  {activeTab === 'revision' && (language === 'telugu' ? '📚 రివిజన్ ప్లాన్ తయారు చేయి' : language === 'hindi' ? '📚 रिवीजन प्लान बनाएं' : '📚 Create 7-Day Revision Plan')}
                  {activeTab === 'currentaffairs' && (language === 'telugu' ? '📰 కరెంట్ అఫైర్స్ పొందు' : language === 'hindi' ? '📰 करंट अफेयर्स पाएं' : "📰 Get Today's Current Affairs")}
                  {activeTab === 'weakness' && (language === 'telugu' ? '📊 నా బలహీనతలు విశ్లేషించు' : language === 'hindi' ? '📊 कमजोरियां विश्लेषण करें' : '📊 Analyze My Weaknesses')}
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                <input className="input flex-1 text-sm"
                  placeholder={
                    language === 'telugu' ? 'మీ ప్రశ్న ఇక్కడ టైప్ చేయండి...' :
                    language === 'hindi' ? 'यहाँ अपना प्रश्न टाइप करें...' :
                    'Type your question here...'
                  }
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
                {['Unlimited AI messages', 'All 11 AI sections', 'Telugu + Hindi + English', 'Unlimited mock tests', 'Personalized study plans', 'Priority support'].map(f => (
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
