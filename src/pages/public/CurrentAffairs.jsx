import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Newspaper, Search, Bookmark } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const categories = ['All', 'National', 'State AP', 'State TS', 'Economy', 'Science & Tech', 'Sports', 'Awards', 'International']

export default function CurrentAffairs() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [bookmarked, setBookmarked] = useState({}) // { [article_id]: bookmark_id }

  useEffect(() => {
    supabase.from('current_affairs').select('*').order('published_date', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  // Load this user's current-affairs bookmarks (RLS: own rows only)
  useEffect(() => {
    if (!user) { setBookmarked({}); return }
    supabase.from('bookmarks').select('id, item_id')
      .eq('user_id', user.id).eq('item_type', 'current_affairs')
      .then(({ data }) => {
        const map = {}
        for (const b of data || []) map[b.item_id] = b.id
        setBookmarked(map)
      })
  }, [user])

  async function toggleBookmark(articleId) {
    if (!user) { toast('Login to bookmark articles'); return }
    const existingId = bookmarked[articleId]
    if (existingId) {
      const { error } = await supabase.from('bookmarks').delete().eq('id', existingId)
      if (error) { toast.error('Could not remove bookmark'); return }
      setBookmarked(prev => { const n = { ...prev }; delete n[articleId]; return n })
      toast.success('Bookmark removed')
    } else {
      const { data, error } = await supabase.from('bookmarks')
        .insert([{ user_id: user.id, item_type: 'current_affairs', item_id: articleId }])
        .select('id').single()
      if (error) { toast.error('Could not save bookmark'); return }
      setBookmarked(prev => ({ ...prev, [articleId]: data.id }))
      toast.success('Bookmarked! See it on your dashboard.')
    }
  }

  const filtered = items.filter(a =>
    (cat === 'All' || a.category === cat) &&
    (a.title.toLowerCase().includes(search.toLowerCase()) || (a.content || '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <Layout>
      <Helmet><title>Current Affairs - AP TS Exam Hub</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold">Current Affairs</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Daily GK updates for AP & TS state exams.</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${cat === c ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No articles found.</div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(a => (
              <div key={a.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  {a.category && <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{a.category}</span>}
                  <span className="text-xs text-gray-400">{a.published_date ? new Date(a.published_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                  <button onClick={() => toggleBookmark(a.id)} title={bookmarked[a.id] ? 'Remove bookmark' : 'Bookmark this article'}
                    className={`ml-auto p-1.5 rounded-lg transition-colors ${bookmarked[a.id] ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    <Bookmark className={`h-4 w-4 ${bookmarked[a.id] ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <h3 className="font-semibold text-base mb-1">{a.title}</h3>
                {a.content && <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{a.content}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
