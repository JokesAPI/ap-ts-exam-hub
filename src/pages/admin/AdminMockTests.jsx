import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'

// Phase 10 -- Admin Mock Test Management.
//
// Activates/deactivates existing mock_tests destinations. Deliberately does
// NOT create, edit, or delete mock_tests rows, and never touches
// mock_questions -- this page's only write is a single-field
// { is_active } update on one mock_tests row at a time, gated by the
// existing mock_tests_write_admin RLS policy (admin-only, already covers
// UPDATE -- no migration needed).
//
// Question counts are not a mock_tests column, so they're derived here:
// one narrow (test_id, status) query against mock_questions, aggregated
// client-side per test_id. At current and reasonably-projected content
// volume (low thousands of rows) this is cheaper and simpler than adding a
// new RPC or view; see the Phase 10 design audit for the future-scale
// alternative (extending get_question_metrics() with a by-test_id
// breakdown) if that ever changes.

// Pure resolution step for load(): decides, from the two raw query results,
// whether the load succeeded and (if so) what `tests`/`counts` should become.
// Extracted specifically so the fail-closed behavior below is unit-testable
// without mocking React state -- load() itself does nothing but call this
// and apply the result, so this is the one and only place that decision
// logic lives.
function resolveLoadResult({ testRows, testsErr, qRows, qErr }) {
  if (testsErr || qErr) {
    return { ok: false, error: testsErr?.message || qErr?.message || 'Failed to load mock tests.' }
  }

  const agg = {}
  for (const row of qRows || []) {
    const tid = row.test_id
    if (!agg[tid]) agg[tid] = { total: 0, published: 0, draft: 0, other: 0 }
    agg[tid].total += 1
    if (row.status === 'published') agg[tid].published += 1
    else if (row.status === 'draft') agg[tid].draft += 1
    else agg[tid].other += 1 // rejected / in_review / anything else -- counts toward total only
  }

  return { ok: true, tests: testRows || [], counts: agg }
}

export default function AdminMockTests() {
  const [tests, setTests] = useState([])
  const [counts, setCounts] = useState({}) // test_id -> { total, published, draft, other }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Single global lock (not per-row-independent) -- deliberately prevents
  // starting a second activate/deactivate anywhere on the page while one is
  // in flight, not just double-clicking the same button. Still tracked by
  // test_id so the correct row's button can show its own "...ing" label.
  const [savingId, setSavingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [{ data: testRows, error: testsErr }, { data: qRows, error: qErr }] = await Promise.all([
      supabase.from('mock_tests').select('*').order('display_order', { ascending: true }),
      supabase.from('mock_questions').select('test_id, status'),
    ])

    const result = resolveLoadResult({ testRows, testsErr, qRows, qErr })

    if (!result.ok) {
      // Fail closed: never leave stale rows on screen paired with a silent
      // wrong count, and never render 0s that look like real data -- show
      // the error and stop, without touching `tests`/`counts` if this was a
      // refresh (so a failed refresh keeps last-known-good data visible
      // under the error banner rather than wiping the table).
      setError(result.error)
      setLoading(false)
      return
    }

    setTests(result.tests)
    setCounts(result.counts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function getCounts(testId) {
    return counts[testId] || { total: 0, published: 0, draft: 0, other: 0 }
  }

  async function setActive(test, nextActive) {
    if (savingId) return // double-submit guard: only one activate/deactivate at a time, page-wide

    const c = getCounts(test.test_id)

    if (nextActive && c.published === 0) {
      toast.error('Cannot activate: 0 published questions')
      return
    }

    const verb = nextActive ? 'Activate' : 'Deactivate'
    const confirmed = confirm(
      `${verb} "${test.title}" (${test.test_id})?\n\n` +
      `Published: ${c.published}\nDraft: ${c.draft}\n\n` +
      (nextActive
        ? 'This will make the test visible to students on the public catalogue.'
        : 'This will immediately hide the test from the public catalogue.')
    )
    if (!confirmed) return

    setSavingId(test.test_id)
    try {
      // Single-field update, filtered to exactly this test_id. Never touches
      // title, subject, access_tier, display_order, description, or any
      // other column.
      const { error: updateErr } = await supabase
        .from('mock_tests')
        .update({ is_active: nextActive })
        .eq('test_id', test.test_id)

      if (updateErr) {
        toast.error(updateErr.message)
        return
      }

      // Never assume success optimistically -- re-fetch this exact row and
      // verify is_active actually changed before reflecting it in the UI or
      // reporting success.
      const { data: fresh, error: refetchErr } = await supabase
        .from('mock_tests')
        .select('*')
        .eq('test_id', test.test_id)
        .maybeSingle()

      if (refetchErr || !fresh || fresh.is_active !== nextActive) {
        toast.error('Update could not be verified -- please refresh and check manually.')
        return
      }

      setTests(prev => prev.map(t => (t.test_id === test.test_id ? fresh : t)))
      toast.success(`${fresh.title} is now ${nextActive ? 'active' : 'inactive'}`)
    } finally {
      setSavingId(null)
    }
  }

  const anySaving = savingId !== null

  return (
    <AdminLayout>
      <Helmet><title>Mock Tests - AP TS Exam Hub Admin</title></Helmet>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mock Tests</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Activate or deactivate official mock test destinations</p>
        </div>
        <button onClick={load} disabled={loading || anySaving} className="btn-secondary text-sm disabled:opacity-60">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="card p-4 mb-6 text-sm text-red-600 bg-red-50 dark:bg-red-900/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : tests.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th className="px-3 py-3 font-semibold">Title</th>
                <th className="px-3 py-3 font-semibold">Test ID</th>
                <th className="px-3 py-3 font-semibold">Subject</th>
                <th className="px-3 py-3 font-semibold">Access Tier</th>
                <th className="px-3 py-3 font-semibold">Published</th>
                <th className="px-3 py-3 font-semibold">Draft</th>
                <th className="px-3 py-3 font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Display Order</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tests.map(t => {
                const c = getCounts(t.test_id)
                const rowSaving = savingId === t.test_id
                const canActivate = c.published > 0
                return (
                  <tr key={t.test_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-3 font-medium">{t.title}</td>
                    <td className="px-3 py-3 text-gray-500 font-mono text-xs">{t.test_id}</td>
                    <td className="px-3 py-3 text-gray-500">{t.subject || '—'}</td>
                    <td className="px-3 py-3"><span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 capitalize">{t.access_tier}</span></td>
                    <td className="px-3 py-3">{c.published}</td>
                    <td className="px-3 py-3">{c.draft}</td>
                    <td className="px-3 py-3">{c.total}</td>
                    <td className="px-3 py-3 text-gray-500">{t.display_order}</td>
                    <td className="px-3 py-3">
                      <span className={`badge ${t.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {t.is_active ? (
                        <button
                          onClick={() => setActive(t, false)}
                          disabled={anySaving}
                          className="btn-secondary text-xs py-1.5 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" /> {rowSaving ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      ) : (
                        <div>
                          <button
                            onClick={() => setActive(t, true)}
                            disabled={anySaving || !canActivate}
                            title={!canActivate ? 'Cannot activate: 0 published questions' : ''}
                            className="btn-primary text-xs py-1.5 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> {rowSaving ? 'Activating...' : 'Activate'}
                          </button>
                          {!canActivate && (
                            <p className="text-xs text-red-500 mt-1">Cannot activate: 0 published questions</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <div className="card p-8 text-center text-gray-400">No mock tests found.</div>
      ) : null}
    </AdminLayout>
  )
}
