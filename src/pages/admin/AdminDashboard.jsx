import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, FileText, Newspaper, FileArchive, Plus, ListChecks, Bot, CheckCircle2, Clock, Activity } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ notifications: 0, exams: 0, current_affairs: 0, previous_papers: 0 })
  const [qm, setQm] = useState(null) // question metrics

  useEffect(() => {
    const tables = ['notifications', 'exams', 'current_affairs', 'previous_papers']
    Promise.all(tables.map(t => supabase.from(t).select('*', { count: 'exact', head: true }))).then(results => {
      setCounts({
        notifications: results[0].count || 0,
        exams: results[1].count || 0,
        current_affairs: results[2].count || 0,
        previous_papers: results[3].count || 0,
      })
    })
    supabase.rpc('get_question_metrics').then(({ data }) => { if (data) setQm(data) })
  }, [])

  const stats = [
    { label: 'Notifications', count: counts.notifications, icon: Bell, color: 'text-red-500 bg-red-50 dark:bg-red-900/20', to: '/admin/notifications' },
    { label: 'Exams', count: counts.exams, icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', to: '/admin/exams' },
    { label: 'Current Affairs', count: counts.current_affairs, icon: Newspaper, color: 'text-green-500 bg-green-50 dark:bg-green-900/20', to: '/admin/current-affairs' },
    { label: 'Previous Papers', count: counts.previous_papers, icon: FileArchive, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', to: '/admin/papers' },
  ]

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome to AP TS Exam Hub admin panel.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map(({ label, count, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-3xl font-bold mt-1">{count}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Phase 5: real Question Bank metrics */}
      {qm && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Question Bank</h2>
            <Link to="/admin/questions" className="text-sm text-primary-600 hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Total', value: qm.total_questions, icon: ListChecks },
              { label: 'Published', value: qm.published, icon: CheckCircle2 },
              { label: 'Draft', value: qm.draft, icon: Clock },
              { label: 'AI Generated', value: qm.ai_generated, icon: Bot },
              { label: 'Human Verified', value: qm.human_verified, icon: CheckCircle2 },
              { label: 'Pending Review', value: qm.question_drafts_pending, icon: Activity },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-4">
                <Icon className="h-4 w-4 text-primary-600 mb-1.5" />
                <p className="text-2xl font-bold">{value ?? 0}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="font-semibold text-sm mb-3">Questions by Subject</p>
              {(qm.by_subject || []).length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
                <div className="space-y-2">
                  {qm.by_subject.slice(0, 6).map(s => (
                    <div key={s.subject} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300 truncate">{s.subject}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-4">
              <p className="font-semibold text-sm mb-3">Questions by Exam</p>
              {(qm.by_exam || []).length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
                <div className="space-y-2">
                  {qm.by_exam.slice(0, 6).map(e => (
                    <div key={e.exam} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300 truncate">{e.exam}</span>
                      <span className="font-semibold">{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/admin/notifications', label: 'Add Notification', color: 'border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/10' },
            { to: '/admin/exams', label: 'Add Exam', color: 'border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/10' },
            { to: '/admin/current-affairs', label: 'Add Article', color: 'border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-900/10' },
            { to: '/admin/papers', label: 'Upload Paper', color: 'border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-900/10' },
          ].map(({ to, label, color }) => (
            <Link key={to} to={to} className={`card p-4 border-2 ${color} transition-colors flex items-center gap-2 text-sm font-medium`}>
              <Plus className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
