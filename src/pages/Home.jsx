import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { Bell, BookOpen, Newspaper, FileText, ChevronRight, TrendingUp, Users, Award } from 'lucide-react'

const quickLinks = [
  { to: '/notifications', label: 'Notifications', labelTe: 'నోటిఫికేషన్లు', icon: Bell, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  { to: '/exams', label: 'Upcoming Exams', labelTe: 'రాబోయే పరీక్షలు', icon: BookOpen, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  { to: '/current-affairs', label: 'Current Affairs', labelTe: 'సమకాలీన అంశాలు', icon: Newspaper, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  { to: '/previous-papers', label: 'Previous Papers', labelTe: 'పాత పరీక్ష పేపర్లు', icon: FileText, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
]

const stats = [
  { label: 'Exams Covered', value: '50+', icon: Award },
  { label: 'Previous Papers', value: '500+', icon: FileText },
  { label: 'Students Helped', value: '10K+', icon: Users },
  { label: 'Daily Updates', value: '24/7', icon: TrendingUp },
]

export default function Home() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { setNotifications(data || []); setLoading(false) })
  }, [])

  return (
    <>
      <Helmet>
        <title>AP TS Exam Hub | Home</title>
        <meta name="description" content="AP TS Exam Hub - Your one-stop portal for AP & Telangana State Exams. Notifications, Previous Papers, Current Affairs." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/30 rounded-full px-4 py-1.5 text-sm mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Updated Daily
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">AP TS Exam Hub</h1>
          <p className="text-xl text-blue-100 mb-2">Your one-stop portal for AP & Telangana State Exams</p>
          <p className="text-lg text-blue-200 font-telugu mb-8">AP మరియు తెలంగాణ పరీక్షలకు మీ సంపూర్ణ మార్గదర్శి</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/exams" className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors">View Exams</Link>
            <Link to="/previous-papers" className="border border-white/40 text-white px-6 py-3 rounded-lg hover:bg-white/10 transition-colors">Download Papers</Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{s.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {quickLinks.map(link => (
            <Link key={link.to} to={link.to} className={`card border ${link.border} p-5 hover:shadow-md transition-shadow group`}>
              <div className={`w-10 h-10 rounded-lg ${link.color} flex items-center justify-center mb-3`}>
                <link.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">{link.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-telugu mt-0.5">{link.labelTe}</div>
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-2 group-hover:gap-2 transition-all">View <ChevronRight className="w-3 h-3" /></div>
            </Link>
          ))}
        </div>

        {/* Latest Notifications */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Latest Notifications</h2>
              <p className="text-sm text-gray-500 font-telugu">తాజా నోటిఫికేషన్లు</p>
            </div>
            <Link to="/notifications" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>)}</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map(n => (
                <div key={n.id} className="py-3 flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.type === 'urgent' ? 'bg-red-500' : n.type === 'important' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  {n.type === 'urgent' && <span className="badge bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">Urgent</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
