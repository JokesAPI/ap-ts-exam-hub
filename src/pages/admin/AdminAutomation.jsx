import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import {
  Activity, CheckCircle2, XCircle, Clock, AlertTriangle, Inbox,
  RefreshCw, Layers, Bot,
} from 'lucide-react'

function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminAutomation() {
  const [health, setHealth] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    const [{ data: h, error: he }, { data: m }] = await Promise.all([
      supabase.rpc('get_automation_health'),
      supabase.rpc('get_question_metrics'),
    ])
    if (he) setError(he.message)
    setHealth(h || null)
    setMetrics(m || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const sources = health?.sources || []
  // success rate from source aggregates (real data; no fabrication)
  const totDraft = sources.reduce((s, x) => s + (x.total_drafted || 0), 0)
  const totPub   = sources.reduce((s, x) => s + (x.total_published || 0), 0)
  const totRej   = sources.reduce((s, x) => s + (x.total_rejected || 0), 0)
  const successRate = (totPub + totRej) > 0 ? Math.round((totPub / (totPub + totRej)) * 100) : null

  const cards = [
    { label: 'Pending drafts', value: health?.pending_drafts ?? 0, icon: Inbox },
    { label: 'Published today', value: health?.published_today ?? 0, icon: CheckCircle2 },
    { label: 'Total processed', value: health?.total_processed ?? 0, icon: Activity },
    { label: 'Duplicates caught', value: health?.total_duplicates ?? 0, icon: Layers },
    { label: 'Dead-letter (open)', value: health?.dead_letter_unresolved ?? 0, icon: AlertTriangle },
    { label: 'Success rate', value: successRate === null ? '—' : `${successRate}%`, icon: RefreshCw },
  ]

  return (
    <AdminLayout>
      <Helmet><title>Automation - AP TS Exam Hub Admin</title></Helmet>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Automation</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Content pipeline health & monitoring</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {error && (
        <div className="card p-4 mb-6 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Health cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-4">
                <Icon className="h-4 w-4 text-primary-600 mb-1.5" />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Last run / success / failure */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-1">Last run</p>
              <p className="font-semibold text-sm">{health?.last_run?.source_name || '—'}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />{fmtTime(health?.last_run?.started_at)}
                {health?.last_run && (health.last_run.success
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />
                  : <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-1">Last success</p>
              <p className="font-semibold text-sm">{health?.last_success?.source_name || '—'}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{fmtTime(health?.last_success?.finished_at)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-1">Last failure</p>
              <p className="font-semibold text-sm">{health?.last_failure?.source_name || 'None 🎉'}</p>
              {health?.last_failure && (
                <p className="text-xs text-red-500 mt-1 line-clamp-2">{health.last_failure.error_message}</p>
              )}
            </div>
          </div>

          {/* Sources table */}
          <h2 className="font-semibold text-lg mb-3">Sources</h2>
          <div className="card overflow-x-auto mb-8">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Drafted</th>
                  <th className="px-4 py-3 font-semibold">Published</th>
                  <th className="px-4 py-3 font-semibold">Rejected</th>
                  <th className="px-4 py-3 font-semibold">Last run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sources.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No automation sources configured yet.</td></tr>
                ) : sources.map(s => (
                  <tr key={s.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.source_type || '—'}</td>
                    <td className="px-4 py-3">{s.total_drafted ?? 0}</td>
                    <td className="px-4 py-3 text-green-600">{s.total_published ?? 0}</td>
                    <td className="px-4 py-3 text-red-500">{s.total_rejected ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtTime(s.last_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent AI activity (real ai_draft_logs) */}
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2"><Bot className="h-5 w-5 text-primary-600" /> Recent AI Activity</h2>
          <div className="card p-4">
            {(metrics?.recent_ai_activity || []).length === 0 ? (
              <p className="text-sm text-gray-400">No AI activity logged yet.</p>
            ) : (
              <div className="space-y-2">
                {metrics.recent_ai_activity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 capitalize">{a.event.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400 text-xs">{a.actor}</span>
                    </span>
                    <span className="text-gray-400 text-xs">{fmtTime(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
