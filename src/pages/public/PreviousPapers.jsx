import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileArchive, Search, Download, SearchX, X } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const PAGE_SIZE = 10
// Skinny select for the main list — no description/pdf metadata beyond what
// the card renders.
const COLUMNS = 'id, title, exam_category, organization, year, subject, description, pdf_url, created_at'

// Duplicated verbatim from CurrentAffairs.jsx (not exported there) rather than
// introducing a different sanitizer, per the reuse requirement. Escapes ILIKE
// wildcards and strips characters PostgREST's .or() mini-language treats as
// syntax (comma, parens, quotes) so free-text input can never be interpreted
// as filter syntax.
function sanitizeSearchTerm(term) {
  return term.trim()
    .replace(/[,()"]/g, '')
    .replace(/[%_]/g, '\\$&')
}

export default function PreviousPapers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0) // 0-indexed

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [examCategory, setExamCategory] = useState('All')
  const [organization, setOrganization] = useState('All')
  const [year, setYear] = useState('All')

  // Facet lists for the three filter dropdowns, populated once (see below).
  const [facets, setFacets] = useState({ examCategories: [], organizations: [], years: [] })

  // Debounce search input so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, examCategory, organization, year])

  // ── Facet query — run once on mount, not on every search/filter/page change.
  // Fetches only the three columns filters are built from (not the full row),
  // capped at 1000 rows so it stays bounded rather than unbounded.
  // TECH DEBT: this scales with row count, not with distinct-value count. Fine
  // at today's volume; once the table is large this should become a small
  // Postgres RPC returning DISTINCT values, which needs its own migration and
  // is out of scope here.
  useEffect(() => {
    supabase.from('previous_papers').select('exam_category, organization, year').limit(1000)
      .then(({ data }) => {
        const rows = data || []
        const dedupeSorted = key =>
          Array.from(new Set(rows.map(r => r[key]).filter(v => v !== null && v !== undefined && String(v).trim() !== '')))
            .sort((a, b) => String(a).localeCompare(String(b)))
        setFacets({
          examCategories: dedupeSorted('exam_category'),
          organizations: dedupeSorted('organization'),
          years: Array.from(new Set(rows.map(r => r.year).filter(v => v !== null && v !== undefined)))
            .sort((a, b) => b - a),
        })
      })
  }, [])

  // ── Main list query — server-side search, filters, and pagination.
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    let query = supabase
      .from('previous_papers')
      .select(COLUMNS, { count: 'exact' })
      .order('year', { ascending: false, nullsFirst: false })
      .order('title', { ascending: true })
      .order('id', { ascending: true })

    if (examCategory !== 'All') query = query.eq('exam_category', examCategory)
    if (organization !== 'All') query = query.eq('organization', organization)
    if (year !== 'All') query = query.eq('year', Number(year))

    const term = sanitizeSearchTerm(debouncedSearch)
    if (term) {
      query = query.or(`title.ilike.%${term}%,subject.ilike.%${term}%`)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    query.then(({ data, count, error }) => {
      if (cancelled) return
      if (error) {
        console.error('Previous papers query error:', error)
        setItems([])
        setTotalCount(0)
      } else {
        setItems(data || [])
        setTotalCount(count ?? 0)
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [examCategory, organization, year, debouncedSearch, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const filtersActive = search !== '' || examCategory !== 'All' || organization !== 'All' || year !== 'All'

  function clearFilters() {
    setSearch(''); setExamCategory('All'); setOrganization('All'); setYear('All')
  }

  const skeletons = useMemo(() => Array.from({ length: PAGE_SIZE }), [])

  return (
    <Layout>
      <Helmet><title>Previous Papers - AP TS Exam Hub</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <FileArchive className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold">Previous Papers</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Download previous year question papers for APPSC, TSPSC, and more.</p>

        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <label htmlFor="papers-search" className="sr-only">Search papers by title or subject</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="papers-search"
              type="search"
              className="input pl-9"
              placeholder="Search by title or subject..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3">
            <div>
              <label htmlFor="papers-exam-category" className="sr-only">Filter by exam category</label>
              <select id="papers-exam-category" className="input sm:w-40" value={examCategory} onChange={e => setExamCategory(e.target.value)}>
                <option value="All">All categories</option>
                {facets.examCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="papers-organization" className="sr-only">Filter by organization</label>
              <select id="papers-organization" className="input sm:w-40" value={organization} onChange={e => setOrganization(e.target.value)}>
                <option value="All">All organizations</option>
                {facets.organizations.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="papers-year" className="sr-only">Filter by year</label>
              <select id="papers-year" className="input sm:w-28" value={year} onChange={e => setYear(e.target.value)}>
                <option value="All">All years</option>
                {facets.years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 text-sm text-gray-500 dark:text-gray-400">
            <p aria-live="polite">
              {totalCount} {totalCount === 1 ? 'paper' : 'papers'}
              {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
            </p>
            {filtersActive && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4" aria-hidden="true">
            {skeletons.map((_, i) => (
              <div key={i} className="card p-5 flex items-start justify-between gap-3 animate-pulse">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 mb-3">
                    <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        ) : totalCount === 0 && !filtersActive ? (
          <div className="text-center py-16">
            <FileArchive className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="font-medium text-gray-600 dark:text-gray-300">No papers published yet</p>
            <p className="text-sm text-gray-400 mt-1">New question papers are added regularly — check back soon.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <SearchX className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="font-medium text-gray-600 dark:text-gray-300">No papers match your filters</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Try a different search term or clear the filters.</p>
            <button onClick={clearFilters} className="btn-secondary text-sm">
              <X className="h-4 w-4" /> Clear filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map(p => (
              <div key={p.id} className="card p-5 hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {p.exam_category && <span className="badge bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{p.exam_category}</span>}
                    {p.organization && p.organization !== p.exam_category && <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{p.organization}</span>}
                    {p.year && <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{p.year}</span>}
                    {p.subject && <span className="badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{p.subject}</span>}
                  </div>
                  <h3 className="font-semibold text-sm break-words">{p.title}</h3>
                  {p.description && <p className="text-xs text-gray-400 mt-1">{p.description}</p>}
                </div>
                {p.pdf_url && (
                  <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                    aria-label={`Download PDF: ${p.title}`}
                    title={`Download ${p.title}`}
                    className="flex-shrink-0 p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            ))}
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
