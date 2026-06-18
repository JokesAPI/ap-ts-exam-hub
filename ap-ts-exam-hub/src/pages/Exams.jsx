import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { BookOpen, Calendar, Search, ExternalLink } from 'lucide-react'

const statusColors = {
  upcoming: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  closed: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

export default function Exams() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('exams').select('*').order('exam_date', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = items.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || e.organization?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || e.status === filter
    return matchSearch && matchFilter
  })

  return (
    <>
      <Helmet>
        <title>Exams | AP TS Exam Hub</title>
        <meta name="description" content="Upcoming AP & Telangana government exams - APPSC, TSPSC, AP Police, TS Police and more." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Exams</h1>
          <p className="text-gray-500 dark:text-gray-400 font-telugu">పరీక్షల వివరాలు</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search exams or organization..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all', 'upcoming', 'active', 'closed'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === s ? 'bg-blue-600 text-white' : 'btn-secondary'}`}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No exams found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map(exam => (
              <div key={exam.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">{exam.title}</h3>
                  <span className={`badge ${statusColors[exam.status] || statusColors.upcoming} capitalize flex-shrink-0`}>{exam.status}</span>
                </div>
                {exam.organization && <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-2">{exam.organization}</p>}
                {exam.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{exam.description}</p>}
                <div className="space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
                  {exam.exam_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /><span>Exam Date: <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(exam.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></span></div>}
                  {exam.last_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-red-400" /><span>Last Date: <span className="font-medium text-red-600 dark:text-red-400">{new Date(exam.last_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></span></div>}
                  {exam.vacancies && <div className="text-sm">Vacancies: <span className="font-semibold text-gray-900 dark:text-white">{exam.vacancies}</span></div>}
                </div>
                {exam.official_link && (
                  <a href={exam.official_link} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Official Website
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
