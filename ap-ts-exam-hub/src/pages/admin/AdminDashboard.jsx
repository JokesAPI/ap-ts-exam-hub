import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, FileText, Newspaper, FileArchive, Plus } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ notifications: 0, exams: 0, current_affairs: 0, previous_papers: 0 })

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

      <div>
        <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
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
