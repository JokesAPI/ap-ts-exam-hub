import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { loadAttemptPage, loadExamLookup, formatDuration, PAGE_SIZE } from '../../lib/attempts'
import { History, Search, FileText, AlertCircle } from 'lucide-react'

// Colour thresholds match the result screen in MockTestEngine (80 / 60).
function badgeClass(pct) {
  if (typeof pct !== 'number') return 'bg-gray-100 text-gray-600'
  if (pct >= 80) return 'bg-green-100 text-green-700'
  if (pct >= 60) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

export default function AttemptHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [examByTest, setExamByTest] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 300ms debounce — matches AdminDrafts.jsx / AdminQuestions.jsx
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to the first page whenever the search changes, so we never land on an
  // out-of-range page.
  useEffect(() => { setPage(0) }, [searchDebounced])

  // Exam names: fetched once, not on every page change.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadExamLookup(supabase)
      .then(map => { if (!cancelled) setExamByTest(map) })
      .catch(() => { /* Exam column degrades to "—"; the list still works. */ })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setError('')
    loadAttemptPage(supabase, { userId: user.id, page, search: searchDebounced })
      .then(({ rows, total }) => {
        if (cancelled) return
        setRows(rows)
        setTotal(total)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user, page, searchDebounced])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const skeletons = useMemo(() => Array.from({ length: PAGE_SIZE }), [])
  const searching = searchDebounced !== ''

  return (
    <Layout>
      <Helmet><title>My Attempts - AP TS Exam Hub</title></Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="flex items-center gap-3 mb-2">
          <History className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold">My Attempts</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Every mock test you have taken, newest first.
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <label htmlFor="attempt-search" className="sr-only">Search attempts by test title</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            id="attempt-search"
            className="input pl-9"
            placeholder="Search by test title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <div className="card p-5 flex items-start gap-3 mb-4">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Could not load your attempts</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="card p-4 space-y-3" aria-hidden="true">
            {skeletons.map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        )}

        {/* Empty — no attempts at all */}
        {!loading && !error && total === 0 && !searching && (
          <div className="card p-8 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No attempts yet.</p>
            <button onClick={() => navigate('/mock-tests')} className="btn-primary mt-3 inline-flex">
              Start Mock Test
            </button>
          </div>
        )}

        {/* Empty — search returned nothing */}
        {!loading && !error && total === 0 && searching && (
          <div className="card p-8 text-center text-gray-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No attempts match “{searchDebounced}”.</p>
            <button onClick={() => setSearch('')} className="btn-secondary mt-3 inline-flex">
              Clear search
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && total > 0 && (
          <>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Test</th>
                    <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Exam</th>
                    <th className="px-4 py-3 text-left font-semibold">Score</th>
                    <th className="px-4 py-3 text-left font-semibold">Percentage</th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Time</th>
                    <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map(r => {
                    const exam = examByTest.get(r.test_id) || null
                    const date = new Date(r.created_at).toLocaleDateString('en-IN')
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium">
                          {r.test_title || r.test_id}
                          {/* Exam and date are their own columns from md/lg up. */}
                          <span className="block lg:hidden text-xs font-normal text-gray-400 mt-0.5">
                            {exam || '—'}<span className="md:hidden"> · {date}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{exam || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.score}/{r.total}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${badgeClass(r.percentage)}`}>
                            {typeof r.percentage === 'number' ? `${r.percentage}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{formatDuration(r.time_taken)}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500">{date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination — matches AdminQuestions.jsx */}
            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
              <p className="text-xs text-gray-400">
                {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total} attempts
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Previous
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Page {page + 1} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6">
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    </Layout>
  )
}
