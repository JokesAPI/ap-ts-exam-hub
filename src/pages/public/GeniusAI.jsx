import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { Send, Bot, User, Sparkles, Brain, FileText, Target, Clock, Lock, BookOpen, Mic, BarChart2, Briefcase, MessageSquare, Calendar, TrendingUp, ChevronRight, Globe } from 'lucide-react'

const FREE_LIMIT = 5
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
  if (lang === 'telugu') return 'IMPORTANT: Reply ONLY in Telugu language (తెలుగు లిపిలో మాత్రమే సమాధానం ఇవ్వండి). Use Telugu script throughout.'
  if (lang === 'hindi') return 'IMPORTANT: Reply ONLY in Hindi language (हिंदी में उत्तर दें). Use Devanagari script throughout.'
  return 'Reply in clear English.'
}

function getSystemPrompt(tabId, lang) {
  const langInstr = getLangInstruction(lang)
  const base = `You are Genius AI, a personal exam coach for AP and Telangana state exam aspirants in India. Help with APPSC, TSPSC, AP Police, DSC, TET, RRB, SSC exams. ${langInstr}`

  const prompts = {
    chat: base,
    mock: `${base} Generate a 10-question MCQ mock test for APPSC Group-2. Format: Q1. [Question] A) B) C) D) Answer: [letter] Explanation: [brief]`,
    explain: `${base} Explain concepts clearly with examples, analogies, and mnemonics. Make it easy to remember.`,
    studyplan: `${base} Create detailed, practical study plans with specific daily schedules, subject-wise time allocation.`,
    doubt: `${base} Explain doubts clearly with examples. Use simple language.`,
    career: `${base} Give realistic detailed career roadmaps with timelines and actionable steps for government jobs.`,
    interview: `${base} Generate relevant interview questions with ideal answers and presentation tips.`,
    english: `${base} Help students improve English communication with practical exercises and interview tips.`,
    revision: `${base} Create smart revision schedules focusing on high-weightage topics and spaced repetition.`,
    currentaffairs: `${base} Summarize news in exam-relevant format with key facts students need to remember.`,
    weakness: `${base} Analyze student weaknesses objectively and provide actionable improvement strategies.`,
  }
  return prompts[tabId] || base
}

function getQuickPrompt(tabId, lang) {
  const prompts = {
    mock: 'Generate a 10-question MCQ mock test for APPSC Group-2 General Studies with answers and explanations.',
    studyplan: 'Create a 90-day study plan for APPSC Group-2 exam with daily schedule and subject-wise time allocation.',
    career: 'Create a complete career roadmap for becoming an IAS/IPS officer from Andhra Pradesh with timeline and steps.',
    interview: 'Generate 10 important APPSC Group-2 interview questions with ideal answers.',
    english: 'Give me 5 English speaking practice exercises for government job interviews with model answers.',
    revision: 'Create a 7-day revision plan for APPSC covering History, Polity, Economy, Science, Current Affairs.',
    currentaffairs: 'Summarize the most important current affairs of this week relevant to APPSC and TSPSC exams with key points.',
    weakness: 'Analyze top 5 weak areas of APPSC aspirants and give specific strategies to improve each one.',
  }
  return prompts[tabId]
}

function getWelcomeMessage(tabId, lang) {
  const messages = {
    chat: { english: 'Hello! 👋 I am Genius AI — your personal APPSC/TSPSC exam coach!\n\nAsk me anything about exams, current affairs, study tips or career guidance.\n\nYou have 5 free messages today!', telugu: 'నమస్కారం! 👋 నేను Genius AI — మీ వ్యక్తిగత పరీక్ష కోచ్!\n\nపరీక్షలు, కరెంట్ అఫైర్స్, చదువు గురించి ఏదైనా అడగండి.\n\nఈ రోజు 5 ఉచిత సందేశాలు ఉన్నాయి!', hindi: 'नमस्ते! 👋 मैं Genius AI हूं — आपका व्यक्तिगत परीक्षा कोच!\n\nपरीक्षा, करंट अफेयर्स, पढ़ाई के बारे में कुछ भी पूछें।\n\nआज 5 मुफ्त संदेश हैं!' },
    mock: { english: '📝 Mock Test Generator\n\nClick "Generate Mock Test" for instant APPSC/TSPSC practice questions with answers!', telugu: '📝 మాక్ టెస్ట్ జనరేటర్\n\nAPPSC/TSPSC ప్రాక్టీస్ ప్రశ్నల కోసం "మాక్ టెస్ట్ జనరేట్ చేయి" నొక్కండి!', hindi: '📝 मॉक टेस्ट जनरेटर\n\nAPPSC/TSPSC प्रैक्टिस प्रश्नों के लिए "मॉक टेस्ट जनरेट करें" दबाएं!' },
    explain: { english: '📖 Answer Explainer\n\nPaste any question or topic and I will explain it clearly with examples!', telugu: '📖 సమాధాన వివరణ\n\nఏదైనా ప్రశ్న లేదా అంశాన్ని పేస్ట్ చేయండి, నేను స్పష్టంగా వివరిస్తాను!', hindi: '📖 उत्तर व्याख्याता\n\nकोई भी प्रश्न या विषय पेस्ट करें, मैं उदाहरण सहित स्पष्ट करूंगा!' },
    studyplan: { english: '📅 Study Plan Creator\n\nTell me your exam and available days — I will create a personalized plan!', telugu: '📅 స్టడీ ప్లాన్ క్రియేటర్\n\nమీ పరీక్ష మరియు అందుబాటులో ఉన్న రోజులు చెప్పండి!', hindi: '📅 स्टडी प्लान क्रिएटर\n\nअपनी परीक्षा और उपलब्ध दिन बताएं — मैं व्यक्तिगत योजना बनाऊंगा!' },
    doubt: { english: '🤔 Doubt Solver\n\nAsk any subject doubt — History, Polity, Economy, Science. I will explain clearly!', telugu: '🤔 డౌట్ సాల్వర్\n\nచరిత్ర, పాలిటీ, ఎకానమీ, సైన్స్ — ఏ అనుమానమైనా అడగండి!', hindi: '🤔 संदेह समाधानकर्ता\n\nइतिहास, राजनीति, अर्थव्यवस्था, विज्ञान — कोई भी संदेह पूछें!' },
    career: { english: '🎯 Career Roadmap\n\nTell me your career goal and I will create a complete roadmap!', telugu: '🎯 కెరీర్ రోడ్‌మ్యాప్\n\nమీ కెరీర్ లక్ష్యం చెప్పండి — పూర్తి రోడ్‌మ్యాప్ తయారు చేస్తాను!', hindi: '🎯 करियर रोडमैप\n\nअपना करियर लक्ष्य बताएं — मैं पूरा रोडमैप तैयार करूंगा!' },
    interview: { english: '💼 Interview Prep\n\nI will generate important interview Q&A for your target exam. Which post?', telugu: '💼 ఇంటర్వ్యూ ప్రిపరేషన్\n\nమీ లక్ష్య పరీక్షకు ముఖ్యమైన ప్రశ్నోత్తరాలు తయారు చేస్తాను!', hindi: '💼 इंटरव्यू तैयारी\n\nआपकी लक्ष्य परीक्षा के लिए महत्वपूर्ण प्रश्नोत्तर तैयार करूंगा!' },
    english: { english: '🎤 English Speaking Practice\n\nI will help you practice English for government job interviews!', telugu: '🎤 ఇంగ్లీష్ స్పీకింగ్ ప్రాక్టీస్\n\nప్రభుత్వ ఉద్యోగ ఇంటర్వ్యూల కోసం ఇంగ్లీష్ నేర్చుకోండి!', hindi: '🎤 अंग्रेजी बोलने का अभ्यास\n\nसरकारी नौकरी इंटरव्यू के लिए अंग्रेजी का अभ्यास करें!' },
    revision: { english: '📚 Revision Planner\n\nTell me your exam date and weak subjects — I will create a revision schedule!', telugu: '📚 రివిజన్ ప్లానర్\n\nపరీక్ష తేదీ మరియు బలహీన సబ్జెక్టులు చెప్పండి!', hindi: '📚 रिवीजन प्लानर\n\nपरीक्षा तिथि और कमजोर विषय बताएं — रिवीजन शेड्यूल बनाऊंगा!' },
    currentaffairs: { english: '📰 Current Affairs Summarizer\n\nClick below to get this week\'s important current affairs for AP & TS exams!', telugu: '📰 కరెంట్ అఫైర్స్ సమ్మరీ\n\nAP & TS పరీక్షలకు ఈ వారం ముఖ్యమైన కరెంట్ అఫైర్స్ పొందండి!', hindi: '📰 करंट अफेयर्स सारांश\n\nAP & TS परीक्षाओं के लिए इस सप्ताह के महत्वपूर्ण करंट अफेयर्स पाएं!' },
    weakness: { english: '📊 Weakness Analyzer\n\nI will identify your weak areas and suggest improvement strategies!', telugu: '📊 వీక్‌నెస్ అనాలిజర్\n\nమీ బలహీన అంశాలు గుర్తించి మెరుగుదల వ్యూహాలు సూచిస్తాను!', hindi: '📊 कमजोरी विश्लेषक\n\nआपके कमजोर क्षेत्रों की पहचान करके सुधार रणनीतियां सुझाऊंगा!' },
  }
  return messages[tabId]?.[lang] || messages[tabId]?.english || 'How can I help you?'
}

export default function GeniusAI() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgCount, setMsgCount] = useState(0)
  const [showPaywall, setShowPaywall] = useState(false)
  const [language, setLanguage] = useState('english')
  const bottomRef = useRef(null)
  const currentTab = tabs.find(t => t.id === activeTab)

  useEffect(() => {
    const today = new Date().toDateString()
    const savedDate = localStorage.getItem(RESET_KEY)
    if (savedDate !== today) {
      localStorage.setItem(RESET_KEY, today)
      localStorage.setItem(STORAGE_KEY, '0')
      setMsgCount(0)
    } else {
      const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
      setMsgCount(count)
      if (count >= FREE_LIMIT) setShowPaywall(true)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  // Reset messages when language changes
  useEffect(() => {
    setMessages({})
  }, [language])

  const currentMessages = messages[activeTab] || [
    { role: 'assistant', content: getWelcomeMessage(activeTab, language) }
  ]

  async function sendMessage(customPrompt) {
    const userText = customPrompt || input.trim()
    if (!userText) return
    if (msgCount >= FREE_LIMIT) { setShowPaywall(true); return }

    const newCount = msgCount + 1
    setMsgCount(newCount)
    localStorage.setItem(STORAGE_KEY, String(newCount))
    if (newCount >= FREE_LIMIT) setShowPaywall(true)

    const newUserMsg = { role: 'user', content: userText }
    const updatedMessages = [...currentMessages, newUserMsg]
    setMessages(prev => ({ ...prev, [activeTab]: updatedMessages }))
    setInput('')
    setLoading(true)

    try {
      const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: getSystemPrompt(activeTab, language) },
            ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      })
      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'Sorry, could not process. Please try again.'
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: reply }]
      }))
    } catch {
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: 'Error connecting. Please check your internet and try again.' }]
      }))
    }
    setLoading(false)
  }

  const remaining = Math.max(0, FREE_LIMIT - msgCount)

  return (
    <Layout>
      <Helmet>
        <title>Genius AI - Personal Exam Coach | AP TS Exam Hub</title>
        <meta name="description" content="AI exam coach for APPSC TSPSC in Telugu, Hindi and English. Mock tests, study plans, doubt solving." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-primary-800 to-primary-600 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> Powered by Groq AI — Fastest AI in the world
          </div>
          <h1 className="text-3xl font-extrabold mb-1">Genius AI 🧠</h1>
          <p className="text-blue-100 mb-1">Your Personal APPSC / TSPSC Exam Coach</p>
          <p className="text-sm text-blue-200">Available in English • తెలుగు • हिंदी</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Language selector + free limit */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {/* Language buttons */}
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-400" />
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
              {LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => setLanguage(lang.code)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${language === lang.code ? 'bg-primary-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {lang.flag} {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Free limit */}
          <div className={`px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-1.5 ${remaining > 2 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : remaining > 0 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'}`}>
            <Clock className="h-3.5 w-3.5" />
            {remaining > 0 ? `${remaining} free messages left today` : 'Limit reached — Upgrade!'}
          </div>
        </div>

        <div className="flex gap-5">
          {/* Sidebar */}
          <div className="hidden md:flex flex-col w-48 flex-shrink-0 gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                  <Icon className={`h-4 w-4 flex-shrink-0 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Mobile tabs */}
          <div className="md:hidden w-full">
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    <Icon className="h-4 w-4" />
                    {tab.label.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 card overflow-hidden flex flex-col" style={{minHeight: '560px'}}>
            {/* Tab header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => { const Icon = currentTab.icon; return <Icon className={`h-5 w-5 ${currentTab.color}`} /> })()}
                <h2 className="font-semibold">{currentTab.label}</h2>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                {LANGUAGES.find(l => l.code === language)?.flag} {LANGUAGES.find(l => l.code === language)?.label}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl">
                    <div className="flex gap-1">
                      {[0,150,300].map(d => <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}></div>)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick action button */}
            {getQuickPrompt(activeTab, language) && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => sendMessage(getQuickPrompt(activeTab, language))}
                  disabled={loading || msgCount >= FREE_LIMIT}
                  className="btn-primary text-sm py-2 disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  {activeTab === 'mock' && (language === 'telugu' ? 'మాక్ టెస్ట్ జనరేట్ చేయి' : language === 'hindi' ? 'मॉक टेस्ट जनरेट करें' : 'Generate Mock Test')}
                  {activeTab === 'studyplan' && (language === 'telugu' ? 'స్టడీ ప్లాన్ తయారు చేయి' : language === 'hindi' ? 'स्टडी प्लान बनाएं' : 'Generate Study Plan')}
                  {activeTab === 'career' && (language === 'telugu' ? 'కెరీర్ రోడ్‌మ్యాప్ పొందు' : language === 'hindi' ? 'करियर रोडमैप पाएं' : 'Generate Career Roadmap')}
                  {activeTab === 'interview' && (language === 'telugu' ? 'ఇంటర్వ్యూ ప్రశ్నలు పొందు' : language === 'hindi' ? 'इंटरव्यू प्रश्न पाएं' : 'Generate Interview Questions')}
                  {activeTab === 'english' && (language === 'telugu' ? 'ఇంగ్లీష్ ప్రాక్టీస్ ప్రారంభించు' : language === 'hindi' ? 'अंग्रेजी अभ्यास शुरू करें' : 'Start English Practice')}
                  {activeTab === 'revision' && (language === 'telugu' ? 'రివిజన్ ప్లాన్ తయారు చేయి' : language === 'hindi' ? 'रिवीजन प्लान बनाएं' : 'Create Revision Plan')}
                  {activeTab === 'currentaffairs' && (language === 'telugu' ? 'కరెంట్ అఫైర్స్ పొందు' : language === 'hindi' ? 'करंट अफेयर्स पाएं' : "Get Today's Current Affairs")}
                  {activeTab === 'weakness' && (language === 'telugu' ? 'నా బలహీనతలు విశ్లేషించు' : language === 'hindi' ? 'मेरी कमजोरियां विश्लेषण करें' : 'Analyze My Weaknesses')}
                </button>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              {showPaywall ? (
                <div className="bg-gradient-to-r from-purple-600 to-primary-600 rounded-xl p-4 text-white text-center">
                  <Lock className="h-6 w-6 mx-auto mb-1" />
                  <p className="font-bold mb-1">
                    {language === 'telugu' ? 'రోజువారీ ఉచిత పరిమితి అయిపోయింది!' : language === 'hindi' ? 'दैनिक मुफ्त सीमा समाप्त!' : 'Daily Free Limit Reached!'}
                  </p>
                  <p className="text-xs text-purple-100 mb-3">
                    {language === 'telugu' ? 'అనర్హమైన యాక్సెస్ కోసం అప్‌గ్రేడ్ చేయండి' : language === 'hindi' ? 'असीमित पहुंच के लिए अपग्रेड करें' : 'Upgrade for unlimited Genius AI access'}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-xl font-extrabold">₹99<span className="text-sm font-normal">/month</span></div>
                    <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer"
                      className="bg-white text-purple-700 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-purple-50">
                      {language === 'telugu' ? 'అప్‌గ్రేడ్ చేయండి' : language === 'hindi' ? 'अपग्रेड करें' : 'Upgrade Now'}
                    </a>
                  </div>
                  <p className="text-xs text-purple-200 mt-2">
                    {language === 'telugu' ? 'రేపటి అర్ధరాత్రి రీసెట్ అవుతుంది' : language === 'hindi' ? 'कल मध्यरात्रि रीसेट होगा' : 'Resets tomorrow at midnight'}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm"
                    placeholder={
                      language === 'telugu' ? 'APPSC, TSPSC గురించి ఏదైనా అడగండి...' :
                      language === 'hindi' ? 'APPSC, TSPSC के बारे में कुछ भी पूछें...' :
                      'Ask anything about APPSC, TSPSC exams...'
                    }
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} />
                  <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                    className="btn-primary px-4 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-6 card p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div>
              <h3 className="text-xl font-bold mb-1">
                {language === 'telugu' ? 'Genius AI Pro కి అప్‌గ్రేడ్ చేయండి' : language === 'hindi' ? 'Genius AI Pro में अपग्रेड करें' : 'Upgrade to Genius AI Pro'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                {language === 'telugu' ? 'అన్ని 11 AI సాధనాలకు అపరిమిత యాక్సెస్' : language === 'hindi' ? 'सभी 11 AI टूल्स तक असीमित पहुंच' : 'Unlimited access to all 11 AI tools'}
              </p>
              <ul className="grid grid-cols-2 gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                {['Unlimited AI messages', 'All 11 AI sections', 'Telugu + Hindi + English', 'Unlimited mock tests', 'Personalized study plans', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex-shrink-0">
              <p className="text-4xl font-extrabold text-primary-600">₹99</p>
              <p className="text-gray-400 text-sm mb-3">/month</p>
              <a href="/subscribe" className="btn-primary px-8 py-3 inline-flex">
                {language === 'telugu' ? 'ఇప్పుడే పొందండి' : language === 'hindi' ? 'अभी पाएं' : 'Get Pro Now'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
