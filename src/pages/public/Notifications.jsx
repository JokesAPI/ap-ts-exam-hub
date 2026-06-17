import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Bell, ExternalLink, Search } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = items.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <Helmet><title>Notifications - AP TS Exam Hub</title></Helmet>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Latest exam alerts, admit cards, results & official announcements.</p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search notifications..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No notifications found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => (
              <div key={n.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {n.is_important && <span className="badge bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Important</span>}
                      {n.category && <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{n.category}</span>}
                    </div>
                    <h3 className="font-semibold text-base">{n.title}</h3>
                    {n.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{n.description}</p>}
                    <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {n.link && (
                    <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 flex-shrink-0">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
