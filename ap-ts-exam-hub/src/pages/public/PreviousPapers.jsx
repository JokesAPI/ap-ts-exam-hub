import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileArchive, Search, Download } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const orgs = ['All', 'APPSC', 'TSPSC', 'AP Police', 'TS Police', 'DSC', 'RRB', 'SSC', 'Other']

export default function PreviousPapers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [org, setOrg] = useState('All')
  const [year, setYear] = useState('All')

  useEffect(() => {
    supabase.from('previous_papers').select('*').order('year', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const years = ['All', ...Array.from(new Set(items.map(i => String(i.year)).filter(Boolean))).sort((a, b) => b - a)]

  const filtered = items.filter(p =>
    (org === 'All' || p.organization === org) &&
    (year === 'All' || String(p.year) === year) &&
    (p.title.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <Layout>
      <Helmet><title>Previous Papers - AP TS Exam Hub</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <FileArchive className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold">Previous Papers</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Download previous year question papers for APPSC, TSPSC, and more.</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search papers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-36" value={org} onChange={e => setOrg(e.target.value)}>
            {orgs.map(o => <option key={o}>{o}</option>)}
          </select>
          <select className="input sm:w-28" value={year} onChange={e => setYear(e.target.value)}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No papers found.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="card p-5 hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {p.organization && <span className="badge bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{p.organization}</span>}
                    {p.year && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{p.year}</span>}
                    {p.subject && <span className="badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{p.subject}</span>}
                  </div>
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  {p.description && <p className="text-xs text-gray-400 mt-1">{p.description}</p>}
                </div>
                {p.pdf_url && (
                  <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                    <Download className="h-4 w-4" />
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
