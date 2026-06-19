import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Bell, FileText, Newspaper, FileArchive, ArrowRight, TrendingUp, Brain, BarChart2, CheckCircle } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const features = [
  { to: '/notifications',   icon: Bell,        label: 'Notifications',   color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',       desc: 'Latest exam alerts' },
  { to: '/exams',           icon: FileText,    label: 'Exams',           color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',     desc: 'Upcoming exam schedule' },
  { to: '/current-affairs', icon: Newspaper,   label: 'Current Affairs', color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', desc: 'Daily GK updates' },
  { to: '/previous-papers', icon: FileArchive, label: 'Previous Papers', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400', desc: 'Download old papers' },
  { to: '/mock-tests',      icon: Brain,       label: 'Mock Tests',      color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400', desc: 'Practice online' },
  { to: '/genius-ai',       icon: BarChart2,   label: 'Genius AI',       color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400', desc: 'AI exam mentor' },
]

const examsOffered = [
  'APPSC Group-1', 'APPSC Group-2', 'APPSC Group-3',
  'TSPSC Group-1', 'TSPSC Group-2', 'AP Police SI',
  'TS Police SI', 'AP DSC', 'TS DSC', 'AP TET',
  'TS TET', 'RRB NTPC', 'SSC CGL', 'SSC CHSL',
]

export default function Home() {
  const [notifications, setNotifications] = useState([])
  const [exams, setExams]                 = useState([])

  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotifications(data || []))
    supabase.from('exams').select('*').order('exam_date', { ascending: true }).limit(5)
      .then(({ data }) => setExams(data || []))
  }, [])

  return (
    <Layout>
      <Helmet>
        {/* ── Primary SEO ── */}
        <title>AP TS Exam Hub -- Free APPSC TSPSC Exam Preparation Portal</title>
        <meta name="description" content="Best free portal for APPSC, TSPSC, AP Police, DSC, TET exam preparation. Free mock tests, current affairs, previous papers, AI mentor in Telugu and English." />
        <meta name="keywords" content="APPSC mock test, TSPSC exam preparation, AP police exam, DSC TET practice, APPSC Group-2 free test, TSPSC previous papers Telugu, AP TS exam hub" />
        <link rel="canonical" href="https://ap-ts-exam-hub.vercel.app/" />

        {/* ── Open Graph (WhatsApp / Facebook / LinkedIn sharing) ── */}
        <meta property="og:type"        content="website" />
        <meta property="og:title"       content="AP TS Exam Hub -- Free APPSC TSPSC Exam Preparation" />
        <meta property="og:description" content="Free mock tests, current affairs, previous papers and AI mentor for APPSC, TSPSC, AP Police, DSC, TET exams in Telugu and English." />
        <meta property="og:url"         content="https://ap-ts-exam-hub.vercel.app/" />
        <meta property="og:image"       content="https://ap-ts-exam-hub.vercel.app/og-image.png" />
        <meta property="og:site_name"   content="AP TS Exam Hub" />

        {/* ── Twitter Card ── */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="AP TS Exam Hub -- Free APPSC TSPSC Exam Preparation" />
        <meta name="twitter:description" content="Free mock tests, current affairs and AI mentor for AP & TS government exams." />
        <meta name="twitter:image"       content="https://ap-ts-exam-hub.vercel.app/og-image.png" />
      </Helmet>

      {/* ── HERO ── */}
      <section className="bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            AP & Telangana
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
            AP | TS Exam Hub
          </h1>
          <p className="text-xl text-blue-100 mb-1">
            Your one-stop portal for AP & Telangana State Exams
          </p>
          <p className="text-lg text-blue-200 font-telugu mb-8">
            ఆంధ్రప్రదేశ్ మరియు తెలంగాణ పరీక్షలకు మీ సమగ్ర వేదిక
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/mock-tests" className="btn-primary bg-white text-primary-700 hover:bg-blue-50">
              Free Mock Test <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/genius-ai" className="btn-secondary bg-white/10 text-white hover:bg-white/20 border-0">
              Genius AI Mentor
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {features.map(({ to, icon: Icon, label, color, desc }) => (
            <Link key={to} to={to} className="card p-5 hover:shadow-md transition-shadow group">
              <div className={`${color} p-3 rounded-xl w-fit mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm mb-0.5 group-hover:text-primary-600 transition-colors">{label}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── SEO CONTENT BLOCK -- Google reads this ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-3 text-gray-800 dark:text-gray-100">
            Best Free APPSC & TSPSC Exam Preparation Site in Telugu & English
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
            AP TS Exam Hub is the #1 free platform for APPSC Group-1, Group-2, Group-3,
            TSPSC Group-1, Group-2, AP Police SI, TS Police SI, DSC, TET, RRB, and SSC
            exam preparation in Telugu and English. Get free mock tests with instant results,
            daily current affairs, previous year question papers, and AI-powered personal
            mentoring -- all in one place.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            Our Genius AI mentor answers your questions in Telugu, Hindi, and English --
            24/7 exam coaching at zero cost. Practice with AI-generated mock tests, track
            your score, and get personalized weakness analysis to crack your exam faster.
          </p>

          {/* Exams list -- keyword rich for SEO */}
          <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-100">
            Exams We Cover
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {examsOffered.map(exam => (
              <div key={exam} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                {exam}
              </div>
            ))}
          </div>

          {/* Key features */}
          <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-100">
            Why Students Choose AP TS Exam Hub
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: 'Free Mock Tests',       desc: 'AI-generated fresh questions every attempt. Clickable options, timer, instant feedback and score review.' },
              { title: 'Telugu & English',      desc: 'All content available in Telugu and English. Genius AI mentor answers in your language automatically.' },
              { title: 'Daily Current Affairs', desc: 'Important current affairs for APPSC & TSPSC covering National, AP State, TS State, Economy and Science.' },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-primary-700 dark:text-primary-400 mb-1">{title}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LATEST NOTIFICATIONS + UPCOMING EXAMS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-8">

          {/* Notifications */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-red-500" /> Latest Notifications
              </h2>
              <Link to="/notifications" className="text-primary-600 text-sm font-medium hover:underline">View all</Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-sm">No notifications yet.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map(n => (
                  <li key={n.id} className="border-l-2 border-primary-400 pl-3">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString('en-IN')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming Exams */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" /> Upcoming Exams
              </h2>
              <Link to="/exams" className="text-primary-600 text-sm font-medium hover:underline">View all</Link>
            </div>
            {exams.length === 0 ? (
              <p className="text-gray-400 text-sm">No exams listed yet.</p>
            ) : (
              <ul className="space-y-3">
                {exams.map(e => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-gray-400">{e.organization}</p>
                    </div>
                    <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap text-xs">
                      {e.exam_date ? new Date(e.exam_date).toLocaleDateString('en-IN') : 'TBA'}
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
