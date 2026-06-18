import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Bell, BookOpen, Newspaper, FileText, Plus } from 'lucide-react'

const sections = [
  { label: 'Notifications', table: 'notifications', icon: Bell, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', to: '/admin/notifications' },
  { label: 'Exams', table: 'exams', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', to: '/admin/exams' },
  { label: 'Current Affairs', table: 'current_affairs', icon: Newspaper, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', to: '/admin/current-affairs' },
  { label: 'Previous Papers', table: 'previous_papers', icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', to: '/admin/papers' },
]

export default function Dashboard() {
  const [counts, setCounts] = useState({})

  useEffect(() => {
    sections.forEach(async s => {
      const { count } = await supabase.from(s.table).select('*', { count: 'exact', head: true })
      setCounts(prev => ({ ...prev, [s.table]: count || 0 }))
    })
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome to AP TS Exam Hub Admin Panel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {sections.map(s => (
          <Link key={s.table} to={s.to} className="card p-5 hover:shadow-md transition-shadow group">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {counts[s.table] ?? '—'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 group-hover:underline">Manage →</div>
          </Link>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sections.map(s => (
            <Link key={s.to} to={s.to} className="flex items-center gap-2 btn-secondary text-sm justify-center">
              <Plus className="w-4 h-4" /> Add {s.label.split(' ')[0]}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
