import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { Send, Bot, User, Sparkles, Brain, FileText, Target, Clock, Lock, BookOpen, Mic, BarChart2, Briefcase, MessageSquare, Calendar, TrendingUp, ChevronRight } from 'lucide-react'

const FREE_LIMIT = 5
const STORAGE_KEY = 'genius_ai_count'
const RESET_KEY = 'genius_ai_date'

const tabs = [
  { id: 'chat', icon: MessageSquare, label: 'Ask Anything', color: 'text-blue-500', prompt: '' },
  { id: 'mock', icon: Brain, label: 'Mock Test', color: 'text-purple-500', prompt: 'Generate a 10-question MCQ mock test for APPSC Group-2 General Studies. Format each question as:\nQ1. [Question]\nA) [option] B) [option] C) [option] D) [option]\nAnswer: [letter]\nExplanation: [brief explanation]\n\nMake questions exam-relevant.' },
  { id: 'explain', icon: FileText, label: 'Explain Answer', color: 'text-green-500', prompt: 'Explain this concept in simple English suitable for APPSC/TSPSC exam preparation: ' },
  { id: 'studyplan', icon: Calendar, label: 'Study Plan', color: 'text-orange-500', prompt: 'Create a detailed study plan for APPSC Group-2 exam in 90 days. Include:\n- Daily schedule (morning/afternoon/evening)\n- Subject-wise time allocation\n- Weekly revision plan\n- Important topics to cover\n- Tips for each subject' },
  { id: 'doubt', icon: MessageSquare, label: 'Solve Doubt', color: 'text-red-500', prompt: 'I have a doubt about this topic. Please explain clearly with examples: ' },
  { id: 'career', icon: Briefcase, label: 'Career Roadmap', color: 'text-yellow-500', prompt: 'Create a complete career roadmap for a student who wants to become an IAS/IPS officer from Andhra Pradesh. Include:\n- Eligibility criteria\n- Exam stages\n- Preparation timeline\n- Key subjects\n- Success tips' },
  { id: 'interview', icon: Target, label: 'Interview Prep', color: 'text-indigo-500', prompt: 'Generate 10 important interview questions for APPSC Group-2 with ideal answers. Focus on:\n- AP history and culture\n- Current affairs\n- General administration\n- Personality assessment questions' },
  { id: 'english', icon: Mic, label: 'English Practice', color: 'text-pink-500', prompt: 'Help me practice English speaking for government job interviews. Give me:\n- 5 common interview questions in English with model answers\n- Tips to improve spoken English\n- Common mistakes to avoid\n- Practice sentences on current affairs topics' },
  { id: 'revision', icon: BookOpen, label: 'Revision Plan', color: 'text-teal-500', prompt: 'Create a personalized 7-day revision plan for APPSC exam covering:\n- Indian History\n- Indian Polity\n- AP Economy\n- Current Affairs\n- General Science\nInclude specific topics and time slots for each day.' },
  { id: 'currentaffairs', icon: TrendingUp, label: 'Current Affairs', color: 'text-cyan-500', prompt: 'Summarize the most important current affairs of the past week relevant to APPSC and TSPSC exams. Include:\n- National news\n- AP and Telangana state news\n- Economy updates\n- Science and technology\n- Sports and awards\nKeep each point brief and exam-focused.' },
  { id: 'weakness', icon: BarChart2, label: 'Weakness Analyzer', color: 'text-rose-500', prompt: 'Analyze common weak areas of APPSC/TSPSC aspirants and provide:\n- Top 5 subjects where students struggle\n- Why these subjects are difficult\n- Specific strategies to improve each weak area\n- Recommended books and resources\n- Daily practice tips' },
]

export default function GeniusAI() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgCount, setMsgCount] = useState(0)
  const [showPaywall, setShowPaywall] = useState(false)
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

  const currentMessages = messages[activeTab] || [
    { role: 'assistant', content: getWelcomeMessage(activeTab) }
  ]

  function getWelcomeMessage(tabId) {
    const tab = tabs.find(t => t.id === tabId)
    const welcomes = {
      chat: 'నమస్కారం! 🙏 I am Genius AI! Ask me anything about APPSC, TSPSC, AP Police, DSC, TET exams. I will answer in English or Telugu!\n\nYou have **5 free messages** today.',
      mock: '📝 **Mock Test Generator**\n\nI will create instant MCQ mock tests for you!\n\nClick "Generate Mock Test" below or tell me which subject/exam you want a test for.',
      explain: '📖 **Answer Explainer**\n\nPaste any question or topic and I will explain it clearly with examples in simple language!',
      studyplan: '📅 **Study Plan Creator**\n\nTell me:\n- Which exam are you preparing for?\n- How many days do you have?\n- How many hours can you study daily?\n\nI will create a personalized plan!',
      doubt: '🤔 **Doubt Solver**\n\nAsk any subject doubt — History, Polity, Economy, Science, Current Affairs. I will explain clearly!',
      career: '🎯 **Career Roadmap**\n\nTell me your career goal and I will create a complete roadmap with steps, timeline, and tips!',
      interview: '💼 **Interview Prep**\n\nI will generate important interview questions with model answers for your exam. Which post are you preparing for?',
      english: '🎤 **English Speaking Practice**\n\nI will help you practice English for government job interviews. Tell me your current level and I will guide you!',
      revision: '📚 **Revision Planner**\n\nTell me your exam date and weak subjects. I will create a day-wise revision schedule!',
      currentaffairs: '📰 **Current Affairs Summarizer**\n\nI will summarize important current affairs relevant to AP & TS exams. Click "Get Today\'s Current Affairs" below!',
      weakness: '📊 **Weakness Analyzer**\n\nAnswer a few questions and I will identify your weak areas and suggest improvement strategies!',
    }
    return welcomes[tabId] || 'How can I help you?'
  }

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

    const systemPrompts = {
      mock: 'You are an expert APPSC/TSPSC exam question setter. Generate high-quality MCQ mock tests with clear questions, 4 options, correct answer, and brief explanation. Format neatly.',
      explain: 'You are an expert teacher for AP and Telangana state exams. Explain concepts clearly with examples. Use simple English. Give Telugu translation for key terms.',
      studyplan: 'You are an expert APPSC/TSPSC exam coach. Create detailed, practical study plans with specific daily schedules, subject-wise time allocation, and topic lists.',
      doubt: 'You are a subject expert for government competitive exams in India. Explain doubts clearly with examples, analogies, and mnemonics to help remember.',
      career: 'You are a career counselor specializing in government jobs in India. Give realistic, detailed career roadmaps with timelines and actionable steps.',
      interview: 'You are an APPSC/TSPSC interview expert. Generate relevant interview questions with ideal answers, tips on presentation and communication.',
      english: 'You are an English language trainer for government job interviews. Help students improve English communication with practical exercises and tips.',
      revision: 'You are an expert study planner for competitive exams. Create smart revision schedules focusing on high-weightage topics and spaced repetition.',
      currentaffairs: 'You are a current affairs expert for APPSC/TSPSC exams. Summarize news in exam-relevant format with key facts students need to remember.',
      weakness: 'You are an educational psychologist specializing in competitive exam preparation. Analyze student weaknesses objectively and provide actionable improvement strategies.',
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1000,
          system: systemPrompts[activeTab] || 'You are Genius AI, a personal exam coach for AP and Telangana state exam aspirants. Help with APPSC, TSPSC, AP Police, DSC, TET exams. Be encouraging and clear. End responses with: మీరు తప్పకుండా విజయం సాధిస్తారు! 💪',
          messages: updatedMessages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, could not process. Please try again.'
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: reply }]
      }))
    } catch {
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...updatedMessages, { role: 'assistant', content: 'Error connecting to AI. Please check your internet and try again.' }]
      }))
    }
    setLoading(false)
  }

  const remaining = Math.max(0, FREE_LIMIT - msgCount)

  return (
    <Layout>
      <Helmet>
        <title>Genius AI - Personal Exam Coach | AP TS Exam Hub</title>
        <meta name="description" content="AI-powered exam coach for APPSC TSPSC. Mock tests, study plans, doubt solving, career roadmaps and more." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-900 via-primary-800 to-primary-600 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> AI-Powered Exam Coach
          </div>
          <h1 className="text-3xl font-extrabold mb-1">Genius AI 🧠</h1>
          <p className="text-blue-100">Your Personal APPSC / TSPSC Exam Coach — 10 powerful tools in one place</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Free limit banner */}
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between flex-wrap gap-2 ${remaining > 2 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : remaining > 0 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {remaining > 0 ? `${remaining} free messages remaining today` : '⚠️ Daily free limit reached!'}
          </span>
          {remaining === 0 && (
            <button onClick={() => setShowPaywall(true)} className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-semibold">
              Upgrade ₹99/month
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <div className="hidden md:flex flex-col w-52 flex-shrink-0 gap-1">
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
          <div className="md:hidden w-full mb-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
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
          <div className="flex-1 card overflow-hidden flex flex-col" style={{height: '580px'}}>
            {/* Tab header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              {(() => { const Icon = currentTab.icon; return <Icon className={`h-5 w-5 ${currentTab.color}`} /> })()}
              <h2 className="font-semibold">{currentTab.label}</h2>
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

            {/* Quick action buttons */}
            {activeTab !== 'chat' && activeTab !== 'doubt' && activeTab !== 'explain' && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => sendMessage(currentTab.prompt)}
                  disabled={loading || msgCount >= FREE_LIMIT}
                  className="btn-primary text-sm py-2 disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  {activeTab === 'mock' && 'Generate Mock Test'}
                  {activeTab === 'studyplan' && 'Generate Study Plan'}
                  {activeTab === 'career' && 'Generate Career Roadmap'}
                  {activeTab === 'interview' && 'Generate Interview Questions'}
                  {activeTab === 'english' && 'Start English Practice'}
                  {activeTab === 'revision' && 'Create Revision Plan'}
                  {activeTab === 'currentaffairs' && "Get Today's Current Affairs"}
                  {activeTab === 'weakness' && 'Analyze My Weaknesses'}
                </button>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              {showPaywall ? (
                <div className="bg-gradient-to-r from-purple-600 to-primary-600 rounded-xl p-4 text-white text-center">
                  <Lock className="h-6 w-6 mx-auto mb-1" />
                  <p className="font-bold mb-1">Daily Free Limit Reached!</p>
                  <p className="text-xs text-purple-100 mb-3">Upgrade for unlimited Genius AI access</p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <div className="text-xl font-extrabold">₹99<span className="text-sm font-normal">/month</span></div>
                    <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer"
                      className="bg-white text-purple-700 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-purple-50">
                      Upgrade Now
                    </a>
                  </div>
                  <p className="text-xs text-purple-200 mt-2">Resets tomorrow at midnight</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" placeholder={
                    activeTab === 'chat' ? 'Ask anything about APPSC, TSPSC...' :
                    activeTab === 'explain' ? 'Paste question or topic to explain...' :
                    activeTab === 'doubt' ? 'Type your doubt here...' :
                    'Type your message...'
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

        {/* Pricing card */}
        <div className="mt-8 card p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold mb-1">Upgrade to Genius AI Pro</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Unlimited access to all 10 AI tools</p>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                {['Unlimited AI messages', 'All 10 AI sections', 'Unlimited mock tests', 'Study plans', 'Career roadmaps', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-primary-500" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center flex-shrink-0">
              <p className="text-4xl font-extrabold text-primary-600">₹99</p>
              <p className="text-gray-400 text-sm mb-3">/month</p>
              <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer"
                className="btn-primary px-8 py-3">
                Get Pro Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
