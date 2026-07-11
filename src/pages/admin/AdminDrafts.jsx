import { useEffect, useState, useCallback } from 'react'
import { Eye, RefreshCw, CheckCircle2, XCircle, Send, Archive, History, ShieldCheck, AlertTriangle, Activity, Inbox } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUSES = ['all', 'draft', 'validated', 'approved', 'rejected', 'published', 'archived']
const CONTENT_TYPES = ['all', 'current_affairs', 'notifications', 'exams', 'previous_papers']
const PAGE_SIZE = 25
const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
  { value: 'conf_high', label: 'Highest confidence' },
  { value: 'conf_low',  label: 'Lowest confidence' },
]
const DATE_OPTIONS = [
  { value: 'all',   label: 'Any date' },
  { value: 'today', label: 'Last 24h' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
]
const CHECKLIST_ITEMS = [
  'Source verified', 'Title verified', 'Facts verified',
  'Category verified', 'Telugu verified', 'No duplicate',
]

const STATUS_STYLES = {
  draft:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  validated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  approved:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  archived:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
}

// Valid transitions enforced by the existing RPCs — mirrored here so the UI
// only offers actions the database will accept.
const canValidate = d => d.status === 'draft'
const canApprove  = d => d.status === 'validated'
const canPublish  = d => d.status === 'validated' || d.status === 'approved'
const canReject   = d => !['rejected', 'published', 'archived'].includes(d.status)
const canArchive  = d => d.status === 'rejected' || d.status === 'published'

const fmtDate = ts => ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
const typeLabel = t => (t || '').replace(/_/g, ' ')

function StatusBadge({ status }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>{status}</span>
}

function Spinner() {
  return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
}

// ── Automation health strip ────────────────────────────────────────────────────
function HealthStrip({ extra }) {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.rpc('get_automation_health')
    if (err) { setError(err.message); setLoading(false); return }
    setHealth(data); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="card p-4 mb-6 text-sm text-gray-400 animate-pulse">Loading automation health…</div>
  if (error) return (
    <div className="card p-4 mb-6 flex items-center gap-2 text-sm text-red-600">
      <AlertTriangle className="h-4 w-4 shrink-0" /> Could not load automation health: {error}
      <button onClick={load} className="ml-auto btn-secondary text-xs">Retry</button>
    </div>
  )

  const lastRun = health?.last_run
  const lastFailure = health?.last_failure
  const stats = [
    { label: 'Pending drafts', value: health?.pending_drafts ?? 0, icon: Inbox },
    { label: 'Published today', value: health?.published_today ?? 0, icon: CheckCircle2 },
    { label: 'Total processed', value: health?.total_processed ?? 0, icon: Activity },
    { label: 'Duplicates caught', value: health?.total_duplicates ?? 0, icon: ShieldCheck },
    { label: 'Dead letter (open)', value: health?.dead_letter_unresolved ?? 0, icon: AlertTriangle, alert: (health?.dead_letter_unresolved ?? 0) > 0 },
    // P4: computed client-side (no new RPCs / no schema change)
    { label: 'Avg confidence', value: extra?.avgConfidence != null ? extra.avgConfidence.toFixed(2) : '—', icon: Activity },
    { label: 'Published this week', value: extra?.publishedWeek ?? '—', icon: CheckCircle2 },
    { label: 'Rejected today', value: extra?.rejectedToday ?? '—', icon: XCircle },
  ]

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, alert }) => (
          <div key={label} className={`card p-4 ${alert ? 'ring-1 ring-red-300 dark:ring-red-800' : ''}`}>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><Icon className="h-3.5 w-3.5" />{label}</div>
            <div className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600' : ''}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="card p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Last run: {lastRun ? (
            <>
              <span className="font-medium text-gray-700 dark:text-gray-300">{lastRun.source_name}</span>{' '}
              at {fmtDate(lastRun.started_at)}{' '}
              {lastRun.success
                ? <span className="text-green-600 font-medium">✓ success</span>
                : <span className="text-red-600 font-medium">✗ failed</span>}
            </>
          ) : 'never'}
        </span>
        {lastFailure && (
          <span className="text-red-500 truncate" title={lastFailure.error_message}>
            Last failure: {lastFailure.source_name} — {lastFailure.error_message}
          </span>
        )}
        <button onClick={load} className="md:ml-auto flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors self-start">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminDrafts() {
  const { user } = useAuth()

  // list state
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [counts, setCounts] = useState({})

  // P1: server-side pagination
  const [page, setPage] = useState(0)               // 0-indexed
  const [totalRows, setTotalRows] = useState(0)

  // P2: sorting
  const [sortBy, setSortBy] = useState('newest')    // newest|oldest|conf_high|conf_low

  // P3: additional filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')     // all|today|7d|30d
  const [confMin, setConfMin] = useState('')              // '' = unset
  const [confMax, setConfMax] = useState('')
  const [facets, setFacets] = useState({ categories: [], sources: [] })

  // P4: client-computed stats (no new RPCs, no schema change)
  const [extraStats, setExtraStats] = useState({ avgConfidence: null, publishedWeek: null, rejectedToday: null })

  // P6: visual-only review checklist (never persisted)
  const [checklist, setChecklist] = useState({})

  // preview / edit state
  const [preview, setPreview] = useState(null)        // draft object being previewed
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', content: '', json_data: '' })
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // action confirmation state: { kind: 'reject'|'publish'|'bulk-approve'|..., ids: [], reason: '' }
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // reset to first page whenever a filter/sort/search changes (prevents landing
  // on an out-of-range page, and prevents acting on stale off-screen selections)
  useEffect(() => { setPage(0); setSelected(new Set()) },
    [statusFilter, typeFilter, searchDebounced, categoryFilter, sourceFilter, dateFilter, confMin, confMax, sortBy])

  // apply every active filter to a query builder (shared by list + stats)
  const applyFilters = useCallback(q => {
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (typeFilter !== 'all') q = q.eq('content_type', typeFilter)
    if (searchDebounced) q = q.ilike('title', `%${searchDebounced}%`)
    if (categoryFilter !== 'all') q = q.eq('json_data->>category', categoryFilter)
    if (sourceFilter !== 'all') q = q.eq('source_name', sourceFilter)
    if (confMin !== '') q = q.gte('confidence_score', Number(confMin))
    if (confMax !== '') q = q.lte('confidence_score', Number(confMax))
    if (dateFilter !== 'all') {
      const days = dateFilter === 'today' ? 1 : dateFilter === '7d' ? 7 : 30
      const since = new Date(Date.now() - days * 86400000).toISOString()
      q = q.gte('created_at', since)
    }
    return q
  }, [statusFilter, typeFilter, searchDebounced, categoryFilter, sourceFilter, dateFilter, confMin, confMax])

  const SORTS = {
    newest:    { col: 'created_at',       asc: false },
    oldest:    { col: 'created_at',       asc: true  },
    conf_high: { col: 'confidence_score', asc: false },
    conf_low:  { col: 'confidence_score', asc: true  },
  }

  const load = useCallback(async () => {
    setLoading(true)
    const s = SORTS[sortBy] || SORTS.newest
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = supabase.from('ai_drafts')
      .select('id, content_type, title, source_name, source_url, confidence_score, status, review_notes, ai_model, language, created_at, updated_at, reviewed_at, published_at, content, json_data',
              { count: 'exact' })
      .order(s.col, { ascending: s.asc, nullsFirst: false })
      .range(from, to)
    q = applyFilters(q)

    const { data, error, count } = await q
    if (error) { toast.error(error.message); setLoading(false); return }
    setDrafts(data || [])
    setTotalRows(count ?? 0)
    setSelected(new Set())
    setLoading(false)
  }, [applyFilters, sortBy, page])
  useEffect(() => { load() }, [load])

  // status counts for filter tabs (cheap head-count queries, fire-and-forget)
  const loadCounts = useCallback(async () => {
    const results = await Promise.all(STATUSES.filter(s => s !== 'all').map(async s => {
      const { count } = await supabase.from('ai_drafts').select('id', { count: 'exact', head: true }).eq('status', s)
      return [s, count ?? 0]
    }))
    setCounts(Object.fromEntries(results))
  }, [])
  useEffect(() => { loadCounts() }, [loadCounts])

  // P4: extra stats. Computed WITHOUT new RPCs/schema. These are global (whole
  // table), not page-scoped, so the numbers are truthful rather than reflecting
  // only the 25 loaded rows.
  const loadExtraStats = useCallback(async () => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const [confRes, weekRes, rejRes] = await Promise.all([
      supabase.from('ai_drafts').select('confidence_score').not('confidence_score', 'is', null),
      supabase.from('ai_drafts').select('id', { count: 'exact', head: true })
        .eq('status', 'published').gte('published_at', weekAgo),
      supabase.from('ai_drafts').select('id', { count: 'exact', head: true })
        .eq('status', 'rejected').gte('reviewed_at', startOfToday.toISOString()),
    ])

    const vals = (confRes.data || []).map(r => Number(r.confidence_score)).filter(n => !Number.isNaN(n))
    setExtraStats({
      avgConfidence: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      publishedWeek: weekRes.count ?? 0,
      rejectedToday: rejRes.count ?? 0,
    })
  }, [])
  useEffect(() => { loadExtraStats() }, [loadExtraStats])

  // P3: facet values for the Category / Source dropdowns (derived from real data)
  const loadFacets = useCallback(async () => {
    const { data } = await supabase.from('ai_drafts').select('source_name, json_data').limit(1000)
    const sources = [...new Set((data || []).map(d => d.source_name).filter(Boolean))].sort()
    const categories = [...new Set((data || []).map(d => d.json_data?.category).filter(Boolean))].sort()
    setFacets({ sources, categories })
  }, [])
  useEffect(() => { loadFacets() }, [loadFacets])

  // P7: optimistic refresh. Callers pass the ids they acted on and the resulting
  // status; we patch those rows in place (instant UI) and refresh the cheap
  // count/stat queries in the background — no full list refetch.
  // Called with no args (e.g. the Refresh button) it does a real reload.
  const refreshAll = (ids, newStatus) => {
    if (ids && newStatus) {
      const idSet = new Set(ids)
      setDrafts(prev => prev.map(d => idSet.has(d.id) ? { ...d, status: newStatus } : d))
      setSelected(new Set())
      loadCounts(); loadExtraStats()
      return
    }
    load(); loadCounts(); loadExtraStats()
  }

  // ── selection helpers ────────────────────────────────────────────────────────
  const toggle = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = () => setSelected(prev => prev.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)))
  const selectedDrafts = drafts.filter(d => selected.has(d.id))

  // ── single-draft actions (existing identity-checked RPCs only) ───────────────
  async function runRpc(fn, params, successMsg) {
    setActionBusy(true)
    const { data, error } = await supabase.rpc(fn, params)
    setActionBusy(false)
    if (error) { toast.error(error.message); return null }
    if (successMsg) toast.success(successMsg)
    return data ?? true
  }

  async function doValidate(draft) {
    const failures = await runRpc('validate_draft', { p_draft_id: draft.id })
    if (failures === null) return
    const passed = !(Array.isArray(failures) && failures.length > 0)
    if (!passed) {
      toast.error(`Validation failed: ${failures.join(', ')}`)
    } else {
      toast.success('Draft validated')
    }
    setPreview(null)
    passed ? refreshAll([draft.id], 'validated') : refreshAll()   // P7 optimistic
  }

  async function doApprove(draft) {
    const ok = await runRpc('approve_draft', { p_draft_id: draft.id, p_admin_id: user.id }, 'Draft approved')
    if (ok === null) return
    setPreview(null); refreshAll([draft.id], 'approved')   // P7 optimistic
  }

  async function doReject(ids, reason) {
    if (!reason.trim()) { toast.error('A rejection reason is required'); return }
    if (ids.length === 1) {
      const ok = await runRpc('reject_draft', { p_draft_id: ids[0], p_admin_id: user.id, p_reason: reason.trim() }, 'Draft rejected')
      if (ok === null) return
    } else {
      const n = await runRpc('bulk_reject_drafts', { p_draft_ids: ids, p_admin_id: user.id, p_reason: reason.trim() })
      if (n === null) return
      toast.success(`${n} draft(s) rejected`)
    }
    setConfirmAction(null); setPreview(null); refreshAll()
  }

  async function doPublish(ids) {
    if (ids.length === 1) {
      const res = await runRpc('publish_draft', { p_draft_id: ids[0], p_admin_id: user.id })
      if (res === null) return
      toast.success(`Published to ${typeLabel(res?.target_table) || 'live table'}`)
    } else {
      const res = await runRpc('bulk_publish_drafts', { p_draft_ids: ids, p_admin_id: user.id })
      if (res === null) return
      const arr = Array.isArray(res) ? res : []
      const failed = arr.filter(r => r.error)
      const okCount = arr.length - failed.length
      if (okCount > 0) toast.success(`${okCount} draft(s) published`)
      failed.forEach(f => toast.error(`One draft failed: ${f.error}`))
    }
    setConfirmAction(null); setPreview(null); refreshAll()
  }

  async function doBulkApprove(ids) {
    const n = await runRpc('bulk_approve_drafts', { p_draft_ids: ids, p_admin_id: user.id })
    if (n === null) return
    toast.success(`${n} draft(s) approved`)
    if (n < ids.length) toast(`${ids.length - n} skipped (not in 'validated' status)`, { icon: 'ℹ️' })
    setConfirmAction(null); refreshAll()
  }

  async function doBulkArchive(ids) {
    const n = await runRpc('bulk_archive_drafts', { p_draft_ids: ids, p_admin_id: user.id })
    if (n === null) return
    toast.success(`${n} draft(s) archived`)
    if (n < ids.length) toast(`${ids.length - n} skipped (only rejected/published can be archived)`, { icon: 'ℹ️' })
    setConfirmAction(null); refreshAll()
  }

  // ── preview / edit / versions ────────────────────────────────────────────────
  function openPreview(draft) {
    setPreview(draft)
    setEditing(false)
    setEditForm({
      title: draft.title || '',
      content: draft.content || '',
      json_data: JSON.stringify(draft.json_data || {}, null, 2),
    })
    setVersions([]); setVersionsLoading(true)
    supabase.from('ai_draft_versions')
      .select('id, version_number, title, content, edited_by, edited_at')
      .eq('draft_id', draft.id)
      .order('version_number', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(`Version history: ${error.message}`)
        setVersions(data || []); setVersionsLoading(false)
      })
  }

  async function saveEdit() {
    if (!editForm.title.trim()) { toast.error('Title required'); return }
    let jsonData
    try { jsonData = JSON.parse(editForm.json_data || '{}') }
    catch { toast.error('json_data is not valid JSON'); return }
    setSaving(true)
    // Direct RLS-protected update; the existing trg_save_draft_version trigger
    // snapshots the previous version automatically.
    const { error } = await supabase.from('ai_drafts')
      .update({ title: editForm.title.trim(), content: editForm.content, json_data: jsonData, updated_at: new Date().toISOString() })
      .eq('id', preview.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Draft updated (previous version saved automatically)')
    setPreview(null); refreshAll()
  }

  // ── confirmation modal content ───────────────────────────────────────────────
  const confirmMeta = {
    'reject':       { title: 'Reject draft',            verb: 'Reject',  danger: true,  needsReason: true },
    'bulk-reject':  { title: 'Reject selected drafts',  verb: 'Reject',  danger: true,  needsReason: true },
    'publish':      { title: 'Publish draft',           verb: 'Publish', danger: false, needsReason: false, note: 'This inserts the draft into the live table immediately. Students will see it.' },
    'bulk-publish': { title: 'Publish selected drafts', verb: 'Publish', danger: false, needsReason: false, note: 'Each eligible draft is inserted into its live table immediately.' },
    'bulk-approve': { title: 'Approve selected drafts', verb: 'Approve', danger: false, needsReason: false, note: "Only drafts in 'validated' status will be approved; others are skipped." },
    'bulk-archive': { title: 'Archive selected drafts', verb: 'Archive', danger: true,  needsReason: false, note: "Only 'rejected' or 'published' drafts can be archived; others are skipped." },
  }

  function fireConfirm() {
    const { kind, ids, reason } = confirmAction
    if (kind === 'reject' || kind === 'bulk-reject') return doReject(ids, reason || '')
    if (kind === 'publish' || kind === 'bulk-publish') return doPublish(ids)
    if (kind === 'bulk-approve') return doBulkApprove(ids)
    if (kind === 'bulk-archive') return doBulkArchive(ids)
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Drafts</h1>
        <button onClick={() => refreshAll()} className="btn-secondary flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <HealthStrip extra={extraStats} />

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {s}{s !== 'all' && counts[s] !== undefined ? ` (${counts[s]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <select className="input !w-auto text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : typeLabel(t)}</option>)}
          </select>

          {/* P3: category */}
          {facets.categories.length > 0 && (
            <select className="input !w-auto text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {facets.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* P3: source */}
          {facets.sources.length > 0 && (
            <select className="input !w-auto text-sm" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="all">All sources</option>
              {facets.sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* P3: date */}
          <select className="input !w-auto text-sm" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            {DATE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>

          {/* P3: confidence range */}
          <div className="flex items-center gap-1">
            <input type="number" step="0.05" min="0" max="1" className="input !w-20 text-sm" placeholder="min"
              value={confMin} onChange={e => setConfMin(e.target.value)} title="Min confidence" />
            <span className="text-gray-400 text-xs">–</span>
            <input type="number" step="0.05" min="0" max="1" className="input !w-20 text-sm" placeholder="max"
              value={confMax} onChange={e => setConfMax(e.target.value)} title="Max confidence" />
          </div>

          {/* P2: sorting */}
          <select className="input !w-auto text-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input className="input !w-56 text-sm" placeholder="Search title…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium mr-2">{selected.size} selected</span>
          <button onClick={() => setConfirmAction({ kind: 'bulk-approve', ids: [...selected] })}
            disabled={!selectedDrafts.some(canApprove)}
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
          <button onClick={() => setConfirmAction({ kind: 'bulk-publish', ids: [...selected] })}
            disabled={!selectedDrafts.some(canPublish)}
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"><Send className="h-3.5 w-3.5" /> Publish</button>
          <button onClick={() => setConfirmAction({ kind: 'bulk-reject', ids: [...selected], reason: '' })}
            disabled={!selectedDrafts.some(canReject)}
            className="btn-secondary flex items-center gap-1.5 text-red-600 disabled:opacity-40"><XCircle className="h-3.5 w-3.5" /> Reject</button>
          <button onClick={() => setConfirmAction({ kind: 'bulk-archive', ids: [...selected] })}
            disabled={!selectedDrafts.some(canArchive)}
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"><Archive className="h-3.5 w-3.5" /> Archive</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      {/* Draft table */}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={drafts.length > 0 && selected.size === drafts.length} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Type</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Source</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Confidence</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {drafts.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No drafts match the current filters.</td></tr>
              ) : drafts.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="rounded" /></td>
                  <td className="px-4 py-3 font-medium max-w-xs">
                    <button onClick={() => openPreview(d)} className="text-left hover:text-primary-600 transition-colors line-clamp-2">{d.title}</button>
                    {d.review_notes && d.status === 'draft' && (
                      <div className="text-xs text-amber-600 mt-0.5 truncate" title={d.review_notes}>⚠ {d.review_notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 capitalize whitespace-nowrap">{typeLabel(d.content_type)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 whitespace-nowrap">{d.source_name || '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{d.confidence_score != null ? `${Math.round(d.confidence_score * 100)}%` : '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500 whitespace-nowrap">{fmtDate(d.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openPreview(d)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors" title="Preview">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* P1: pagination */}
      {totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing <b>{totalRows === 0 ? 0 : page * PAGE_SIZE + 1}</b>–<b>{Math.min((page + 1) * PAGE_SIZE, totalRows)}</b> of <b>{totalRows}</b>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
              className="btn-secondary text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm font-medium px-2">
              Page {page + 1} of {Math.max(1, Math.ceil(totalRows / PAGE_SIZE))}
            </span>
            <button onClick={() => setPage(p => p + 1)}
              disabled={loading || (page + 1) * PAGE_SIZE >= totalRows}
              className="btn-secondary text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Preview / edit modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={editing ? 'Edit Draft' : 'Draft Preview'} maxWidth="max-w-3xl">
        {preview && (
          <div className="space-y-4">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <StatusBadge status={preview.status} />
              <span className="capitalize">{typeLabel(preview.content_type)}</span>
              {preview.json_data?.category && (
                <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{preview.json_data.category}</span>
              )}
              {preview.language && <span className="uppercase">{preview.language}</span>}
              {preview.ai_model && <span>{preview.ai_model}</span>}
              {preview.confidence_score != null && <span>confidence {Math.round(preview.confidence_score * 100)}%</span>}
              <span>created {fmtDate(preview.created_at)}</span>
            </div>
            {preview.source_url && (
              <a href={preview.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline break-all">
                {preview.source_name ? `${preview.source_name}: ` : ''}{preview.source_url}
              </a>
            )}
            {preview.review_notes && (
              <div className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
                Review notes: {preview.review_notes}
              </div>
            )}

            {/* P6: reviewer checklist — visual aid only, never stored, never blocking */}
            {!editing && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-300">Review checklist (optional)</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {CHECKLIST_ITEMS.map(item => {
                    const key = `${preview.id}:${item}`
                    return (
                      <label key={item} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" className="rounded"
                          checked={!!checklist[key]}
                          onChange={e => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))} />
                        {item}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {editing ? (
              <>
                <div><label className="block text-sm font-medium mb-1">Title *</label>
                  <input className="input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Content</label>
                  <textarea className="input resize-y font-mono text-xs" rows={10} value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">JSON data</label>
                  <textarea className="input resize-y font-mono text-xs" rows={6} value={editForm.json_data} onChange={e => setEditForm({ ...editForm, json_data: e.target.value })} /></div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setEditing(false)} className="btn-secondary" disabled={saving}>Cancel</button>
                  <button onClick={saveEdit} className="btn-primary disabled:opacity-60" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-lg leading-snug">{preview.title}</h3>
                <div className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4 max-h-72 overflow-y-auto">
                  {preview.content || <span className="text-gray-400">No content</span>}
                </div>
                {preview.json_data && Object.keys(preview.json_data).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Structured data (json_data)</summary>
                    <pre className="mt-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 overflow-x-auto">{JSON.stringify(preview.json_data, null, 2)}</pre>
                  </details>
                )}

                {/* Version history */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2"><History className="h-4 w-4" /> Version history</div>
                  {versionsLoading ? (
                    <div className="text-xs text-gray-400 animate-pulse">Loading versions…</div>
                  ) : versions.length === 0 ? (
                    <div className="text-xs text-gray-400">No previous versions — this draft has never been edited.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {versions.map(v => (
                        <details key={v.id} className="text-xs bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                          <summary className="cursor-pointer">
                            <span className="font-medium">v{v.version_number}</span>
                            <span className="text-gray-400"> · {fmtDate(v.edited_at)}</span>
                            <span className="text-gray-500"> · {v.title}</span>
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{v.content || '(no content)'}</pre>
                        </details>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions — only transitions the database will accept are enabled */}
                <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => setEditing(true)} className="btn-secondary" disabled={actionBusy}>Edit</button>
                  {canValidate(preview) && (
                    <button onClick={() => doValidate(preview)} className="btn-secondary flex items-center gap-1.5" disabled={actionBusy}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Validate
                    </button>
                  )}
                  {canReject(preview) && (
                    <button onClick={() => setConfirmAction({ kind: 'reject', ids: [preview.id], reason: '' })}
                      className="btn-secondary text-red-600 flex items-center gap-1.5" disabled={actionBusy}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  )}
                  {canApprove(preview) && (
                    <button onClick={() => doApprove(preview)} className="btn-secondary flex items-center gap-1.5" disabled={actionBusy}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {canPublish(preview) && (
                    <button onClick={() => setConfirmAction({ kind: 'publish', ids: [preview.id] })}
                      className="btn-primary flex items-center gap-1.5" disabled={actionBusy}>
                      <Send className="h-3.5 w-3.5" /> Publish
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Confirmation modal (reject reason + destructive/irreversible actions) */}
      <Modal open={!!confirmAction} onClose={() => !actionBusy && setConfirmAction(null)} title={confirmAction ? confirmMeta[confirmAction.kind]?.title : ''}>
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {confirmAction.ids.length === 1 ? 'This affects 1 draft.' : `This affects up to ${confirmAction.ids.length} drafts.`}
              {confirmMeta[confirmAction.kind]?.note && <span className="block mt-1 text-gray-500">{confirmMeta[confirmAction.kind].note}</span>}
            </p>
            {confirmMeta[confirmAction.kind]?.needsReason && (
              <div>
                <label className="block text-sm font-medium mb-1">Reason *</label>
                <textarea className="input resize-none" rows={3} autoFocus
                  placeholder="Why is this draft being rejected? (stored in review_notes and the audit log)"
                  value={confirmAction.reason || ''}
                  onChange={e => setConfirmAction({ ...confirmAction, reason: e.target.value })} />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConfirmAction(null)} className="btn-secondary" disabled={actionBusy}>Cancel</button>
              <button onClick={fireConfirm} disabled={actionBusy || (confirmMeta[confirmAction.kind]?.needsReason && !(confirmAction.reason || '').trim())}
                className={`${confirmMeta[confirmAction.kind]?.danger ? 'btn-primary !bg-red-600 hover:!bg-red-700' : 'btn-primary'} disabled:opacity-60`}>
                {actionBusy ? 'Working…' : confirmMeta[confirmAction.kind]?.verb}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
