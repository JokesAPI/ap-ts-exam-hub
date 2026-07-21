import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileText, Search, CalendarDays } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

export default function Exams() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const orgs = ['All', 'APPSC', 'TSPSC', 'AP Police', 'TS Police', 'DSC', 'RRB', 'SSC', 'Other']

  useEffect(() => {
    supabase.from('exams').select('*').order('exam_date', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = items.filter(e =>
    (filter === 'All' || e.organization === filter) &&
    ((e.title || e.exam_name || '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <Layout>
      <Helmet><title>Exams - AP TS Exam Hub</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold">Upcoming Exams</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">APPSC, TSPSC, AP/TS Police, DSC and more.</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search exams..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-44" value={filter} onChange={e => setFilter(e.target.value)}>
            {orgs.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No exams found.</div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(e => (
              <div key={e.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{e.organization}</span>
                      {e.status && <span className={`badge ${e.status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{e.status}</span>}
                    </div>
                    <h3 className="font-semibold text-base">{e.title || e.exam_name}</h3>
                    {e.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{e.description}</p>}
                    {e.last_date && <p className="text-xs text-red-500 mt-1">Last Date: {new Date(e.last_date).toLocaleDateString('en-IN')}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                    <CalendarDays className="h-4 w-4" />
                    {e.exam_date ? new Date(e.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'}
                  </div>
                </div>
                {e.notification_url && (
                  <a href={e.notification_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-primary-600 text-sm font-medium hover:underline">
                    Official Notification
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
