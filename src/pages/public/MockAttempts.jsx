import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { TEST_TITLES } from '../../lib/questions'
import {
  attemptPct, pctColorClass, pctBadgeClass, pctBarClass, formatDuration,
} from '../../lib/mockStats'
import {
  History, FileText, Clock, TrendingUp, TrendingDown, ChevronRight,
  RotateCcw, Filter, BarChart2,
} from 'lucide-react'

// Dependency-free mini trend line (reused visual language from the dashboard)
function MiniTrend({ points }) {
  if (points.length < 2) return null
  const W = 240, H = 44, PAD = 4
  const step = (W - PAD * 2) / (points.length - 1)
  const y = v => H - PAD - (v / 100) * (H - PAD * 2)
  const d = points.map((p, i) => `${PAD + i * step},${y(p)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-11" preserveAspectRatio="none" role="img" aria-label="Score trend">
      <polyline points={d} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-600" />
      {points.map((p, i) => <circle key={i} cx={PAD + i * step} cy={y(p)} r="3" className="fill-primary-600" />)}
    </svg>
  )
}

export default function MockAttempts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState(null) // null = loading
  const [testFilter, setTestFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.from('mock_results')
      .select('id, test_id, test_title, score, total, percentage, accuracy, time_taken, subject_stats, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setAttempts(data || []) })
    return () => { cancelled = true }
  }, [user])

  const testLabel = a => a.test_title || TEST_TITLES[a.test_id] || a.test_id

  // Distinct tests for the filter dropdown
  const tests = useMemo(() => {
    if (!attempts) return []
    const map = {}
    for (const a of attempts) map[a.test_id] = testLabel(a)
    return Object.entries(map).map(([id, label]) => ({ id, label }))
  }, [attempts])

  const filtered = useMemo(
    () => (attempts || []).filter(a => testFilter === 'all' || a.test_id === testFilter),
    [attempts, testFilter]
  )

  // Per-test summary cards (best / avg / attempts / trend), oldest→newest for trend
  const perTest = useMemo(() => {
    if (!attempts) return []
    const groups = {}
    for (const a of attempts) {
      (groups[a.test_id] = groups[a.test_id] || []).push(a)
    }
    return Object.entries(groups).map(([id, rows]) => {
      const pcts = rows.map(attemptPct)
      const chrono = [...rows].reverse().map(attemptPct) // oldest first
      return {
        id,
        label: testLabel(rows[0]),
        count: rows.length,
        best: Math.max(...pcts),
        avg: Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length),
        trend: chrono,
        latest: pcts[0],
      }
    }).sort((a, b) => b.count - a.count)
  }, [attempts])

  const overallAvg = attempts && attempts.length
    ? Math.round(attempts.reduce((s, a) => s + attemptPct(a), 0) / attempts.length) : 0
  const overallBest = attempts && attempts.length ? Math.max(...attempts.map(attemptPct)) : 0

  return (
    <Layout>
      <Helmet><title>My Attempts - AP TS Exam Hub</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
            <History className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Attempts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Every mock test you've taken</p>
          </div>
        </div>

        {/* Loading skeleton */}
        {attempts === null ? (
          <div className="mt-6 space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : attempts.length === 0 ? (
          <div className="card p-10 text-center text-gray-400 mt-6">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="mb-4">You haven't taken any mock tests yet.</p>
            <Link to="/mock-tests" className="btn-primary inline-flex">Take your first test</Link>
          </div>
        ) : (
          <>
            {/* Overall summary */}
            <div className="grid grid-cols-3 gap-3 my-6">
              {[
                { label: 'Attempts', value: attempts.length, icon: FileText },
                { label: 'Avg Score', value: `${overallAvg}%`, icon: BarChart2 },
                { label: 'Best Score', value: `${overallBest}%`, icon: TrendingUp },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="card p-4">
                  <Icon className="h-4 w-4 text-primary-600 mb-1.5" />
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Per-test summary cards */}
            {perTest.length > 1 && (
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {perTest.map(t => (
                  <div key={t.id} className="card p-4">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <p className="font-semibold text-sm truncate">{t.label}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{t.count} attempt{t.count !== 1 ? 's' : ''}</span>
                    </div>
                    <MiniTrend points={t.trend} />
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-gray-500">Best <b className={pctColorClass(t.best)}>{t.best}%</b></span>
                      <span className="text-gray-500">Avg <b className={pctColorClass(t.avg)}>{t.avg}%</b></span>
                      <button
                        onClick={() => navigate('/mock-test/start', { state: { testId: t.id, title: t.label } })}
                        className="text-primary-600 font-medium inline-flex items-center gap-1 hover:underline">
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter + full list */}
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-gray-400" />
              <select className="input py-1.5 text-sm max-w-xs" value={testFilter} onChange={e => setTestFilter(e.target.value)}>
                <option value="all">All tests ({attempts.length})</option>
                {tests.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div className="card divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((a, i) => {
                const pct = attemptPct(a)
                // delta vs the chronologically previous attempt of the SAME test
                const sameTest = filtered.filter(x => x.test_id === a.test_id)
                const idxInTest = sameTest.indexOf(a)
                const prev = sameTest[idxInTest + 1] // next in desc order = older
                const delta = prev ? pct - attemptPct(prev) : null
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{testLabel(a)}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                        <span>{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(a.time_taken)}</span>
                        {typeof a.accuracy === 'number' && <span className="hidden sm:inline">· {a.accuracy}% accuracy</span>}
                      </p>
                    </div>
                    {delta !== null && (
                      <span className={`hidden sm:inline-flex items-center text-xs font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {delta >= 0 ? '+' : ''}{delta}%
                      </span>
                    )}
                    <span className={`badge flex-shrink-0 ${pctBadgeClass(pct)}`}>{a.score}/{a.total} · {pct}%</span>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex justify-center">
              <Link to="/mock-tests" className="btn-secondary text-sm">
                <FileText className="h-4 w-4" /> Take another test
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
