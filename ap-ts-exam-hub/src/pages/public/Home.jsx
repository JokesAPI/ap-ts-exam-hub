import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Bell, FileText, Newspaper, FileArchive, ArrowRight, TrendingUp } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const features = [
  { to: '/notifications', icon: Bell, label: 'Notifications', color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400', desc: 'Latest exam alerts' },
  { to: '/exams', icon: FileText, label: 'Exams', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', desc: 'Upcoming exam schedule' },
  { to: '/current-affairs', icon: Newspaper, label: 'Current Affairs', color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', desc: 'Daily GK updates' },
  { to: '/previous-papers', icon: FileArchive, label: 'Previous Papers', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400', desc: 'Download old papers' },
]

export default function Home() {
  const [notifications, setNotifications] = useState([])
  const [exams, setExams] = useState([])

  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setNotifications(data || []))
    supabase.from('exams').select('*').order('exam_date', { ascending: true }).limit(5)
      .then(({ data }) => setExams(data || []))
  }, [])

  return (
    <Layout>
      <Helmet>
        <title>AP TS Exam Hub - AP & Telangana State Exams Portal</title>
        <meta name="description" content="Your one-stop portal for APPSC, TSPSC, AP Police, TS Police, DSC, RRB, SSC exam notifications, previous papers, and current affairs." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">AP & Telangana</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight">AP | TS Exam Hub</h1>
          <p className="text-xl text-blue-100 mb-1">Your one-stop portal for AP & Telangana State Exams</p>
          <p className="text-lg text-blue-200 font-telugu mb-8">ఆంధ్రప్రదేశ్ మరియు తెలంగాణ పరీక్షలకు మీ సమగ్ర వేదిక</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/exams" className="btn-primary bg-white text-primary-700 hover:bg-blue-50">View Exams <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/previous-papers" className="btn-secondary bg-white/10 text-white hover:bg-white/20 border-0">Download Papers</Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Latest notifications + upcoming exams */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Notifications */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-red-500" /> Latest Notifications</h2>
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
              <h2 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-500" /> Upcoming Exams</h2>
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
