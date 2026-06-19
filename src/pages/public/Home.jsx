import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Bell, FileText, Newspaper, FileArchive, ArrowRight, TrendingUp, Users, Award, BookOpen, Zap, Brain, CheckCircle, ChevronRight } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const exams = [
  {
    id: 1,
    name: 'APPSC Group 1',
    org: 'APPSC',
    status: '🔥 Very Hot',
    statusColor: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    date: 'Aug 15, 2026',
    vacancies: '503+',
    color: 'from-blue-600 to-blue-800',
    icon: '🏛️',
    website: 'psc.ap.gov.in',
    links: [
      { label: 'Mock Test', to: '/mock-tests' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Notifications', to: '/notifications' },
    ]
  },
  {
    id: 2,
    name: 'APPSC Group 2',
    org: 'APPSC',
    status: '📢 High Demand',
    statusColor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    date: 'Sept 2026',
    vacancies: '453+',
    color: 'from-indigo-600 to-indigo-800',
    icon: '📋',
    website: 'psc.ap.gov.in',
    links: [
      { label: 'Mock Test', to: '/mock-tests' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Syllabus', to: '/notifications' },
    ]
  },
  {
    id: 3,
    name: 'TSPSC Group 1',
    org: 'TSPSC',
    status: '⚡ Expected Soon',
    statusColor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    date: 'Soon 2026',
    vacancies: '500+',
    color: 'from-purple-600 to-purple-800',
    icon: '🏢',
    website: 'www.tspsc.gov.in',
    links: [
      { label: 'Mock Test', to: '/mock-tests' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Notifications', to: '/notifications' },
    ]
  },
  {
    id: 4,
    name: 'TSPSC Group 2',
    org: 'TSPSC',
    status: '⚡ Coming Soon',
    statusColor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    date: 'Soon 2026',
    vacancies: '400+',
    color: 'from-violet-600 to-violet-800',
    icon: '📁',
    website: 'www.tspsc.gov.in',
    links: [
      { label: 'Mock Test', to: '/mock-tests' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Notifications', to: '/notifications' },
    ]
  },
  {
    id: 5,
    name: 'AP/TS Police SI',
    org: 'AP/TS Police',
    status: '🚨 Big Vacancies',
    statusColor: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    date: 'Aug–Oct 2026',
    vacancies: '1000+',
    color: 'from-green-600 to-green-800',
    icon: '👮',
    website: 'slprb.ap.gov.in',
    links: [
      { label: 'Mock Test', to: '/mock-tests' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Notifications', to: '/notifications' },
    ]
  },
  {
    id: 6,
    name: 'AP/TS EAPCET',
    org: 'AP/TS Board',
    status: '✅ In Progress',
    statusColor: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    date: '2026 Cycle',
    vacancies: 'Counselling',
    color: 'from-teal-600 to-teal-800',
    icon: '🎓',
    website: 'eapcet.sche.ap.gov.in',
    links: [
      { label: 'Mock Test', to: '/mock-tests' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Latest Updates', to: '/notifications' },
    ]
  },
]

const stats = [
  { value: '6+', label: 'Exams Covered', icon: FileText },
  { value: '500+', label: 'Practice Questions', icon: BookOpen },
  { value: 'Daily', label: 'Current Affairs', icon: Newspaper },
  { value: 'Free', label: 'Genius AI', icon: Brain },
]

const features = [
  { icon: Bell, label: 'Exam Notifications', desc: 'Instant alerts for APPSC, TSPSC, Police exams', color: 'bg-red-50 dark:bg-red-900/20 text-red-500', to: '/notifications' },
  { icon: FileText, label: 'Mock Tests', desc: 'Practice with real exam pattern questions', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500', to: '/mock-tests' },
  { icon: Newspaper, label: 'Current Affairs', desc: 'Daily GK updates in Telugu & English', color: 'bg-green-50 dark:bg-green-900/20 text-green-500', to: '/current-affairs' },
  { icon: FileArchive, label: 'Previous Papers', desc: 'Download old question papers free', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500', to: '/previous-papers' },
  { icon: Brain, label: 'Genius AI', desc: 'AI coach in Telugu, Hindi & English', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500', to: '/genius-ai' },
  { icon: Zap, label: 'Daily Quiz', desc: 'Test your knowledge every day', color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-500', to: '/daily-quiz' },
]

export default function Home() {
  const [notifications, setNotifications] = useState([])
  const [upcomingExams, setUpcomingExams] = useState([])

  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotifications(data || []))
    supabase.from('exams').select('*').order('exam_date', { ascending: true }).limit(5)
      .then(({ data }) => setUpcomingExams(data || []))
  }, [])

  return (
    <Layout>
      <Helmet>
        <title>AP TS Exam Hub — #1 Portal for APPSC TSPSC AP TS Police Exams</title>
        <meta name="description" content="Best exam preparation portal for APPSC Group 1, Group 2, TSPSC Group 1, Group 2, AP TS Police SI exams. Free mock tests, current affairs, previous papers in Telugu." />
        <meta name="keywords" content="APPSC Group 1 2026, APPSC Group 2 2026, TSPSC Group 1, TSPSC Group 2, AP Police SI, TS Police SI, AP TS exam hub" />
      </Helmet>

      {/* HERO SECTION - Testbook Style */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/5 rounded-full"></div>
          <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-blue-400/10 rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left content */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                AP & Telangana's #1 Exam Portal
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
                Crack <span className="text-yellow-300">APPSC</span> &{' '}
                <span className="text-yellow-300">TSPSC</span> Exams with Confidence
              </h1>
              <p className="text-lg text-blue-100 mb-2">Your one-stop destination for AP & Telangana government exam preparation</p>
              <p className="text-base text-blue-200 font-telugu mb-8">ఆంధ్రప్రదేశ్ మరియు తెలంగాణ పరీక్షలకు మీ సమగ్ర వేదిక</p>

              <div className="flex flex-wrap gap-3 mb-8">
                <Link to="/mock-tests" className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2">
                  Start Free Mock Test <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/genius-ai" className="bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Try Genius AI Free
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-6">
                {[
                  { num: '6+', label: 'Exams' },
                  { num: '500+', label: 'Questions' },
                  { num: '100%', label: 'Free' },
                  { num: '3', label: 'Languages' },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-2xl font-extrabold text-yellow-300">{s.num}</p>
                    <p className="text-xs text-blue-200">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Illustration (SVG) */}
            <div className="hidden lg:flex justify-center items-center">
              <svg viewBox="0 0 500 400" className="w-full max-w-md" xmlns="http://www.w3.org/2000/svg">
                {/* Background circle */}
                <circle cx="250" cy="200" r="180" fill="rgba(255,255,255,0.05)" />
                <circle cx="250" cy="200" r="140" fill="rgba(255,255,255,0.05)" />

                {/* Laptop/Screen */}
                <rect x="120" y="100" width="260" height="170" rx="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                <rect x="130" y="110" width="240" height="145" rx="6" fill="rgba(30,58,138,0.6)"/>

                {/* Screen content - graph bars */}
                <rect x="155" y="210" width="20" height="35" rx="3" fill="#60a5fa" opacity="0.8"/>
                <rect x="183" y="195" width="20" height="50" rx="3" fill="#34d399" opacity="0.8"/>
                <rect x="211" y="185" width="20" height="60" rx="3" fill="#60a5fa" opacity="0.8"/>
                <rect x="239" y="175" width="20" height="70" rx="3" fill="#fbbf24" opacity="0.8"/>
                <rect x="267" y="165" width="20" height="80" rx="3" fill="#34d399" opacity="0.8"/>
                <rect x="295" y="155" width="20" height="90" rx="3" fill="#60a5fa" opacity="0.8"/>

                {/* Trend line */}
                <polyline points="165,218 193,200 221,188 249,178 277,168 305,158" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>

                {/* Screen text lines */}
                <rect x="145" y="125" width="120" height="8" rx="4" fill="rgba(255,255,255,0.4)"/>
                <rect x="145" y="140" width="80" height="6" rx="3" fill="rgba(255,255,255,0.2)"/>

                {/* Laptop base */}
                <rect x="95" y="270" width="310" height="12" rx="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>

                {/* Floating cards */}
                <rect x="30" y="130" width="80" height="50" rx="8" fill="rgba(99,102,241,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <text x="70" y="152" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">APPSC</text>
                <text x="70" y="167" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="8">Group 1</text>

                <rect x="390" y="130" width="80" height="50" rx="8" fill="rgba(16,185,129,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <text x="430" y="152" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">TSPSC</text>
                <text x="430" y="167" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="8">Group 1</text>

                <rect x="30" y="220" width="80" height="50" rx="8" fill="rgba(245,158,11,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <text x="70" y="242" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Police</text>
                <text x="70" y="257" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="8">SI 2026</text>

                <rect x="390" y="220" width="80" height="50" rx="8" fill="rgba(239,68,68,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <text x="430" y="242" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">DSC</text>
                <text x="430" y="257" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="8">2026</text>

                {/* Student figure */}
                <circle cx="250" cy="330" r="22" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                <circle cx="250" cy="320" r="10" fill="rgba(255,255,255,0.4)"/>
                <path d="M228,355 Q250,340 272,355" fill="rgba(255,255,255,0.3)"/>

                {/* Check marks floating */}
                <circle cx="160" cy="70" r="16" fill="rgba(52,211,153,0.8)"/>
                <text x="160" y="75" textAnchor="middle" fill="white" fontSize="14">✓</text>

                <circle cx="340" cy="70" r="16" fill="rgba(251,191,36,0.8)"/>
                <text x="340" y="75" textAnchor="middle" fill="white" fontSize="12">AI</text>

                <circle cx="420" cy="300" r="14" fill="rgba(99,102,241,0.8)"/>
                <text x="420" y="305" textAnchor="middle" fill="white" fontSize="12">📝</text>

                <circle cx="80" cy="300" r="14" fill="rgba(239,68,68,0.8)"/>
                <text x="80" y="305" textAnchor="middle" fill="white" fontSize="12">🏆</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-primary-600">{value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 EXAM CARDS — Testbook Style */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-extrabold">Popular Exams</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">AP & Telangana's most sought-after government exams</p>
          </div>
          <Link to="/exams" className="text-primary-600 text-sm font-semibold hover:underline flex items-center gap-1">
            View All <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.map(exam => (
            <div key={exam.id} className="card hover:shadow-lg transition-all duration-200 overflow-hidden group">
              {/* Colored header */}
              <div className={`bg-gradient-to-r ${exam.color} p-5 text-white`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-3xl mb-2 block">{exam.icon}</span>
                    <h3 className="font-extrabold text-lg leading-tight">{exam.name}</h3>
                    <p className="text-white/70 text-xs mt-0.5">{exam.org}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-xs">Vacancies</p>
                    <p className="font-bold text-yellow-300 text-lg">{exam.vacancies}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`badge text-xs font-semibold ${exam.statusColor}`}>{exam.status}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">📅 {exam.date}</span>
                </div>

                <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Official: <a href={`https://${exam.website}`} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">{exam.website}</a>
                </div>

                {/* Quick links */}
                <div className="flex gap-2 flex-wrap">
                  {exam.links.map(link => (
                    <Link key={link.label} to={link.to}
                      className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold mb-2">Everything You Need to Crack the Exam</h2>
            <p className="text-gray-500 dark:text-gray-400">All tools in one place — completely free</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, label, desc, color, to }) => (
              <Link key={label} to={to} className="card p-5 hover:shadow-md transition-shadow group">
                <div className={`${color} p-3 rounded-xl w-fit mb-3`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold mb-1 group-hover:text-primary-600 transition-colors">{label}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* GENIUS AI BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="card p-8 bg-gradient-to-r from-purple-900 via-primary-800 to-primary-600 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold mb-4">
              <Brain className="h-3.5 w-3.5" /> Powered by Groq AI
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Meet Genius AI — Your Personal Exam Coach 🧠</h2>
            <p className="text-blue-100 mb-2">Generate mock tests • Solve doubts • Create study plans • All in Telugu, Hindi & English</p>
            <p className="text-blue-200 font-telugu text-sm mb-5">మీ వ్యక్తిగత పరీక్ష కోచ్ — తెలుగు, హిందీ మరియు ఇంగ్లీష్‌లో</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/genius-ai" className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold px-6 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2">
                Try Genius AI Free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* LATEST NOTIFICATIONS + UPCOMING EXAMS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Notifications */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-red-500" /> Latest Notifications
              </h2>
              <Link to="/notifications" className="text-primary-600 text-sm font-medium hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No notifications yet. Check back soon!</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map(n => (
                  <li key={n.id} className="flex items-start gap-3 group">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-snug group-hover:text-primary-600 transition-colors">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    {n.is_important && <span className="badge bg-red-100 dark:bg-red-900/30 text-red-600 text-xs flex-shrink-0">Important</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming Exams */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" /> Upcoming Exams
              </h2>
              <Link to="/exams" className="text-primary-600 text-sm font-medium hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {upcomingExams.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No exams listed yet. Check back soon!</p>
            ) : (
              <ul className="space-y-3">
                {upcomingExams.map(e => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-gray-400">{e.organization}</p>
                    </div>
                    <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap text-xs flex-shrink-0">
                      {e.exam_date ? new Date(e.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBA'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </Layout>
  )
}
