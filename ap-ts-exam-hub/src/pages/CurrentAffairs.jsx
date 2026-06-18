import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { Newspaper, Search } from 'lucide-react'

const categories = ['All', 'AP State', 'Telangana', 'National', 'International', 'Economy', 'Science & Tech', 'Sports']

export default function CurrentAffairs() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    supabase.from('current_affairs').select('*').order('published_date', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = items.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || a.category === category
    return matchSearch && matchCat
  })

  return (
    <>
      <Helmet>
        <title>Current Affairs | AP TS Exam Hub</title>
        <meta name="description" content="Daily current affairs for AP & Telangana exam preparation. AP State, Telangana, National, International news." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Current Affairs</h1>
          <p className="text-gray-500 dark:text-gray-400 font-telugu">సమకాలీన అంశాలు</p>
        </div>

        <div className="mb-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search current affairs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{c}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No articles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(article => (
              <div key={article.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{article.category}</span>
                      <span className="text-xs text-gray-400">{new Date(article.published_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{article.title}</h3>
                    {article.content && <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{article.content}</p>}
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
