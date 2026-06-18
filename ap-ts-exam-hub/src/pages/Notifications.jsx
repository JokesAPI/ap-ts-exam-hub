import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { Bell, Search } from 'lucide-react'

const typeColors = {
  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  important: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  general: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = items.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || n.type === filter
    return matchSearch && matchFilter
  })

  return (
    <>
      <Helmet>
        <title>Notifications | AP TS Exam Hub</title>
        <meta name="description" content="Latest notifications for AP & Telangana state exam candidates." />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400 font-telugu">తాజా నోటిఫికేషన్లు</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search notifications..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all', 'urgent', 'important', 'general'].map(t => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === t ? 'bg-blue-600 text-white' : 'btn-secondary'}`}>{t}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No notifications found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => (
              <div key={n.id} className="card p-4 flex gap-4">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${n.type === 'urgent' ? 'bg-red-500' : n.type === 'important' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{n.title}</h3>
                    <span className={`badge ${typeColors[n.type] || typeColors.general} capitalize`}>{n.type}</span>
                  </div>
                  {n.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{n.description}</p>}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View details →</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
