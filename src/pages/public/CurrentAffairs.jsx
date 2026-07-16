import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Newspaper, Search, ExternalLink, Eye, EyeOff } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const categories = ['All', 'National', 'Economy', 'Science & Tech', 'Sports', 'Awards', 'International']

const PAGE_SIZE = 10

// ── Date range helpers (local time — published_date has no timezone component) ─
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(d) {
  // ISO week: Monday start
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Returns { gte, lte } date strings for the current range, or null for 'all'
function dateRangeFor(rangeKey) {
  const now = new Date()
  const todayStr = toDateStr(now)
  if (rangeKey === 'today') return { gte: todayStr, lte: todayStr }
  if (rangeKey === 'week')  return { gte: toDateStr(startOfWeek(now)), lte: todayStr }
  if (rangeKey === 'month') return { gte: toDateStr(startOfMonth(now)), lte: todayStr }
  return null
}

// Escape ILIKE wildcards (Postgres honors backslash for these) and strip
// characters PostgREST's .or() mini-language treats as syntax (comma, parens,
// quotes) so free-text input can never be interpreted as filter syntax.
function sanitizeSearchTerm(term) {
  return term.trim()
    .replace(/[,()"]/g, '')
    .replace(/[%_]/g, '\\$&')
}

// ── Content parser ───────────────────────────────────────────────────────────
// AI-generated articles store one plain-text blob with stable markers:
//   <english>  📝 MCQ Practice: <q + A-D + Answer + Explanation>
//   తెలుగు సారాంశం: <telugu>   Source: <url>
// Legacy articles have none of these markers. When nothing matches we return
// { english: content } and the card renders exactly as before — so old rows
// cannot break.
function parseArticle(raw) {
  const content = (raw || '').trim()
  if (!content) return { english: '' }

  // Source (last marker) — tolerate "Source:" with or without a scheme
  let rest = content
  let sourceUrl = null
  const srcMatch = rest.match(/\n*\s*Source:\s*(\S+)\s*$/i)
  if (srcMatch) {
    sourceUrl = srcMatch[1].trim()
    rest = rest.slice(0, srcMatch.index).trim()
  }

  // Telugu block
  let telugu = null
  const teMatch = rest.match(/తెలుగు\s*సారాంశం\s*:?/)
  if (teMatch) {
    telugu = rest.slice(teMatch.index + teMatch[0].length).trim()
    rest = rest.slice(0, teMatch.index).trim()
  }

  // MCQ block
  let mcq = null
  const mcqMatch = rest.match(/(?:📝\s*)?MCQ\s*Practice\s*:?/i)
  if (mcqMatch) {
    const block = rest.slice(mcqMatch.index + mcqMatch[0].length).trim()
    rest = rest.slice(0, mcqMatch.index).trim()

    const answerM = block.match(/\n\s*Answer\s*:\s*([A-D])/i)
    const explM = block.match(/\n\s*Explanation\s*:\s*([\s\S]*)$/i)

    // options like "A) text"
    const options = []
    const optRe = /^\s*([A-D])\)\s*(.+)$/gm
    let m
    while ((m = optRe.exec(block)) !== null) options.push({ key: m[1].toUpperCase(), text: m[2].trim() })

    // question = everything before the first option line
    const firstOpt = block.search(/^\s*[A-D]\)\s*/m)
    const question = (firstOpt > -1 ? block.slice(0, firstOpt) : block).trim()

    if (question || options.length) {
      mcq = {
        question,
        options,
        answer: answerM ? answerM[1].toUpperCase() : null,
        explanation: explM ? explM[1].trim() : null,
      }
    }
  }

  return { english: rest.trim(), mcq, telugu, sourceUrl }
}

// ── MCQ card (bordered, answer hidden until revealed) ─────────────────────────
function McqCard({ mcq }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-primary-600 mb-2">📝 MCQ Practice</p>
      {mcq.question && <p className="text-sm font-medium mb-3">{mcq.question}</p>}

      {mcq.options.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {mcq.options.map(o => {
            const isAnswer = revealed && mcq.answer === o.key
            return (
              <li key={o.key}
                className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                  isAnswer
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                <span className="font-semibold mr-1.5">{o.key})</span>{o.text}
              </li>
            )
          })}
        </ul>
      )}

      {(mcq.answer || mcq.explanation) && (
        <>
          <button onClick={() => setRevealed(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline">
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? 'Hide answer' : 'Show answer'}
          </button>
          {revealed && (
            <div className="mt-2 space-y-1">
              {mcq.answer && (
                <p className="text-sm"><span className="font-semibold">Correct answer:</span> {mcq.answer}</p>
              )}
              {mcq.explanation && (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  <span className="font-semibold">Explanation:</span> {mcq.explanation}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CurrentAffairs() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [dateFilter, setDateFilter] = useState('all') // 'all' | 'today' | 'week' | 'month'
  const [page, setPage] = useState(0) // 0-indexed

  // Debounce search input so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(0)
  }, [cat, dateFilter, debouncedSearch])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    let query = supabase
      .from('current_affairs')
      .select('*', { count: 'exact' })
      .order('published_date', { ascending: false })
      .order('id', { ascending: false })

    if (cat !== 'All') {
      query = query.eq('category', cat)
    }

    const range = dateRangeFor(dateFilter)
    if (range) {
      query = query.gte('published_date', range.gte).lte('published_date', range.lte)
    }

    const term = sanitizeSearchTerm(debouncedSearch)
    if (term) {
      query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    query.then(({ data, count, error }) => {
      if (cancelled) return
      if (error) {
        console.error('Current affairs query error:', error)
        setItems([])
        setTotalCount(0)
      } else {
        setItems(data || [])
        setTotalCount(count ?? 0)
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [cat, dateFilter, debouncedSearch, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

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

        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { key: 'all', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
          ].map(d => (
            <button key={d.key} onClick={() => setDateFilter(d.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${dateFilter === d.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {d.label}
            </button>
          ))}
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
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No articles found.</div>
        ) : (
          <div className="grid gap-4">
            {items.map(a => {
              const parsed = parseArticle(a.content)
              const isStructured = !!(parsed.mcq || parsed.telugu || parsed.sourceUrl)
              return (
                <article key={a.id} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    {a.category && <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{a.category}</span>}
                    <span className="text-xs text-gray-400">{a.published_date ? new Date(a.published_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                  </div>
                  <h3 className="font-semibold text-base mb-3">{a.title}</h3>

                  {!isStructured ? (
                    // Legacy article — render exactly as before
                    parsed.english && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{parsed.english}</p>
                    )
                  ) : (
                    // AI-generated article — sectioned. space-y-5 = 20px gaps.
                    <div className="space-y-5">
                      {parsed.english && (
                        <section>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">English Summary</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{parsed.english}</p>
                        </section>
                      )}

                      {parsed.mcq && <McqCard mcq={parsed.mcq} />}

                      {parsed.telugu && (
                        <section>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">🇮🇳 తెలుగు సారాంశం</h4>
                          <p lang="te" className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{parsed.telugu}</p>
                        </section>
                      )}

                      {parsed.sourceUrl && (
                        <section>
                          <a href={parsed.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline font-medium">
                            <ExternalLink className="h-3.5 w-3.5" /> 🔗 Official Source
                          </a>
                        </section>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {!loading && items.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
