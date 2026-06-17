import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { FileText, Download, Search, Filter } from 'lucide-react'

const examOrgs = ['All', 'APPSC', 'TSPSC', 'AP Police', 'TS Police', 'AP DSC', 'TS TET', 'APREIS', 'TSREIS', 'Other']

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

  const years = ['All', ...new Set(items.map(p => p.year).filter(Boolean).sort((a, b) => b - a))]

  const filtered = items.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchOrg = org === 'All' || p.organization === org
    const matchYear = year === 'All' || String(p.year) === String(year)
    return matchSearch && matchOrg && matchYear
  })

  const handleDownload = async (paper) => {
    if (paper.pdf_url) {
      window.open(paper.pdf_url, '_blank')
    }
  }

  return (
    <>
      <Helmet>
        <title>Previous Papers | AP TS Exam Hub</title>
        <meta name="description" content="Download previous year question papers for APPSC, TSPSC, AP Police, TS Police and more AP & Telangana exams." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Previous Papers</h1>
          <p className="text-gray-500 dark:text-gray-400 font-telugu">పాత పరీక్ష పేపర్లు డౌన్లోడ్</p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search papers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Org:</span>
            </div>
            {examOrgs.map(o => (
              <button key={o} onClick={() => setOrg(o)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${org === o ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{o}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">Year:</span>
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${year === String(y) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{y}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No papers found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map(paper => (
              <div key={paper.id} className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
                <div className="bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg flex-shrink-0">
                  <FileText className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug mb-1">{paper.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {paper.organization && <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{paper.organization}</span>}
                    {paper.year && <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{paper.year}</span>}
                    {paper.subject && <span className="text-xs text-gray-400">{paper.subject}</span>}
                  </div>
                  <button
                    onClick={() => handleDownload(paper)}
                    disabled={!paper.pdf_url}
                    className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {paper.pdf_url ? 'Download PDF' : 'Coming Soon'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
