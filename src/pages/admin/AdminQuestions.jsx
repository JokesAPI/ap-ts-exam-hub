import { useEffect, useState, useMemo } from 'react'
import { Trash2, Pencil, Plus, Upload, Search, CheckCircle, Bot, X, Sparkles, FileSpreadsheet } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { generateQuestionDrafts } from '../../lib/aiQuestionGen'
import toast from 'react-hot-toast'

const DIFFICULTIES = ['easy', 'medium', 'hard']
const STATUSES = ['draft', 'in_review', 'approved', 'published', 'rejected', 'archived']
const LANGS = ['en', 'te', 'hi']

const empty = {
  test_id: '', exam_id: '', question: '',
  option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', explanation: '', subject: '', topic: '', subtopic: '',
  difficulty: 'medium', language: 'en', source: '', source_year: '',
  tags: '', status: 'draft',
}

const statusBadge = s => ({
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  in_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  archived:  'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
}[s] || 'bg-gray-100 text-gray-600')

export default function AdminQuestions() {
  const [items, setItems] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  // Phase 4: AI generation
  const [aiModal, setAiModal] = useState(false)
  const [aiForm, setAiForm] = useState({ count: 10, examSlug: '', subject: '', topic: '' })
  const [generating, setGenerating] = useState(false)

  // filters
  const [search, setSearch] = useState('')
  const [fExam, setFExam] = useState('all')
  const [fSubject, setFSubject] = useState('all')
  const [fDifficulty, setFDifficulty] = useState('all')
  const [fStatus, setFStatus] = useState('all')

  const load = () => {
    setLoading(true)
    supabase.from('mock_questions').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); setSelected(new Set()) })
  }
  useEffect(() => {
    load()
    supabase.from('exams').select('id, title, slug').eq('is_active', true).not('slug', 'is', null)
      .order('display_order').then(({ data }) => setExams(data || []))
  }, [])

  const subjects = useMemo(() => Array.from(new Set(items.map(i => i.subject).filter(Boolean))).sort(), [items])

  const filtered = useMemo(() => items.filter(q =>
    (fExam === 'all' || q.exam_id === fExam) &&
    (fSubject === 'all' || q.subject === fSubject) &&
    (fDifficulty === 'all' || q.difficulty === fDifficulty) &&
    (fStatus === 'all' || q.status === fStatus) &&
    (search === '' || q.question?.toLowerCase().includes(search.toLowerCase()))
  ), [items, fExam, fSubject, fDifficulty, fStatus, search])

  function openAdd() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(q) {
    setForm({
      ...empty, ...q,
      exam_id: q.exam_id || '', source_year: q.source_year || '',
      tags: Array.isArray(q.tags) ? q.tags.join(', ') : '',
    })
    setEditing(q.id); setModal(true)
  }

  function buildPayload(f) {
    return {
      test_id: f.test_id?.trim() || null,
      exam_id: f.exam_id || null,
      question: f.question?.trim(),
      option_a: f.option_a, option_b: f.option_b, option_c: f.option_c, option_d: f.option_d,
      correct_answer: f.correct_answer,
      explanation: f.explanation?.trim() || null,
      subject: f.subject?.trim() || null,
      topic: f.topic?.trim() || null,
      subtopic: f.subtopic?.trim() || null,
      difficulty: f.difficulty || null,
      language: f.language || 'en',
      source: f.source?.trim() || null,
      source_year: f.source_year ? Number(f.source_year) : null,
      tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: f.status || 'draft',
    }
  }

  async function save() {
    if (!form.question?.trim()) { toast.error('Question text required'); return }
    if (!['A', 'B', 'C', 'D'].includes(form.correct_answer)) { toast.error('Correct answer must be A/B/C/D'); return }
    if (!form.option_a?.trim() || !form.option_b?.trim() || !form.option_c?.trim() || !form.option_d?.trim()) {
      toast.error('All four options (A–D) are required'); return
    }
    setSaving(true)
    const payload = buildPayload(form)
    if (payload.status === 'published' && !editing) payload.published_at = new Date().toISOString()
    let err
    if (editing) ({ error: err } = await supabase.from('mock_questions').update(payload).eq('id', editing))
    else ({ error: err } = await supabase.from('mock_questions').insert([payload]))
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success(editing ? 'Question updated' : 'Question added')
    setModal(false); load()
  }

  async function remove(id) {
    if (!confirm('Delete this question?')) return
    const { error } = await supabase.from('mock_questions').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted'); load()
  }

  // ── Bulk import (JSON array) ──────────────────────────────────────────────
  async function bulkImport() {
    let rows
    try {
      rows = JSON.parse(importText)
      if (!Array.isArray(rows)) throw new Error('JSON must be an array of question objects')
    } catch (e) { toast.error('Invalid JSON: ' + e.message); return }
    if (rows.length === 0) { toast.error('No questions in array'); return }

    const payloads = []
    for (const [i, r] of rows.entries()) {
      if (!r.question || !['A', 'B', 'C', 'D'].includes(r.correct_answer)) {
        toast.error(`Row ${i + 1}: missing question or invalid correct_answer`); return
      }
      if (!r.option_a || !r.option_b || !r.option_c || !r.option_d) {
        toast.error(`Row ${i + 1}: all four options (option_a–option_d) are required`); return
      }
      payloads.push(buildPayload({
        ...empty, ...r,
        tags: Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || ''),
        status: r.status || 'draft', // imported questions default to DRAFT (never auto-published)
      }))
    }
    setImporting(true)
    const { error } = await supabase.from('mock_questions').insert(payloads)
    setImporting(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Imported ${payloads.length} questions as drafts`)
    setImportModal(false); setImportText(''); load()
  }

  // ── Phase 4: AI question generation → ai_drafts (review queue) ─────────────
  async function runAiGenerate() {
    const count = Math.min(Math.max(Number(aiForm.count) || 10, 1), 100)
    setGenerating(true)
    try {
      const exam = exams.find(e => e.slug === aiForm.examSlug)
      const res = await generateQuestionDrafts({
        count,
        exam: exam?.title || '',
        examSlug: aiForm.examSlug || null,
        subject: aiForm.subject.trim() || null,
        topic: aiForm.topic.trim() || null,
      })
      if (res.inserted === 0) {
        toast.error(`No valid questions generated (${res.skipped} skipped). Try again.`)
      } else {
        toast.success(`${res.inserted} question draft(s) created${res.skipped ? `, ${res.skipped} skipped` : ''}. Review them in AI Drafts.`)
        setAiModal(false)
      }
    } catch (e) {
      toast.error('Generation failed: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Phase 4: CSV import (dependency-free) → drafts ────────────────────────
  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row')
    const split = line => {
      const out = []; let cur = ''; let q = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
        else if (c === ',' && !q) { out.push(cur); cur = '' }
        else cur += c
      }
      out.push(cur); return out.map(s => s.trim())
    }
    const headers = split(lines[0]).map(h => h.toLowerCase())
    return lines.slice(1).map(line => {
      const cells = split(line); const obj = {}
      headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
      return obj
    })
  }

  async function onCsvFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      // reuse the same JSON import path (as drafts, never auto-published)
      setImportText(JSON.stringify(rows, null, 2))
      toast.success(`Parsed ${rows.length} rows from CSV — review then Import as Drafts`)
    } catch (err) {
      toast.error('CSV parse failed: ' + err.message)
    }
    e.target.value = ''
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  async function bulkSetStatus(status) {
    if (selected.size === 0) return
    const patch = { status }
    if (status === 'published') patch.published_at = new Date().toISOString()
    const { error } = await supabase.from('mock_questions').update(patch).in('id', [...selected])
    if (error) { toast.error(error.message); return }
    toast.success(`${selected.size} question(s) → ${status}`)
    load()
  }

  const examTitle = id => exams.find(e => e.id === id)?.title || '—'

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Question Bank</h1>
        <div className="flex gap-2">
          <button onClick={() => setAiModal(true)} className="btn-secondary"><Sparkles className="h-4 w-4" /> AI Generate</button>
          <button onClick={() => setImportModal(true)} className="btn-secondary"><Upload className="h-4 w-4" /> Bulk Import</button>
          <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> Add Question</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-40" value={fExam} onChange={e => setFExam(e.target.value)}>
          <option value="all">All exams</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select className="input sm:w-40" value={fSubject} onChange={e => setFSubject(e.target.value)}>
          <option value="all">All subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input sm:w-32" value={fDifficulty} onChange={e => setFDifficulty(e.target.value)}>
          <option value="all">All levels</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input sm:w-36" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card p-3 mb-4 flex items-center gap-3 flex-wrap bg-primary-50 dark:bg-primary-900/20">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={() => bulkSetStatus('approved')} className="btn-secondary text-xs py-1.5"><CheckCircle className="h-3.5 w-3.5" /> Approve</button>
          <button onClick={() => bulkSetStatus('published')} className="btn-primary text-xs py-1.5"><CheckCircle className="h-3.5 w-3.5" /> Publish</button>
          <button onClick={() => bulkSetStatus('rejected')} className="btn-secondary text-xs py-1.5 text-red-600">Reject</button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-600 ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 font-semibold">Question</th>
                <th className="px-3 py-3 font-semibold hidden md:table-cell">Subject</th>
                <th className="px-3 py-3 font-semibold hidden lg:table-cell">Exam</th>
                <th className="px-3 py-3 font-semibold">Level</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No questions match these filters.</td></tr>
              ) : filtered.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-3 max-w-md">
                    <span className="line-clamp-2">{q.question}</span>
                    {q.ai_generated && <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-0.5"><Bot className="h-3 w-3" /> AI</span>}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-gray-500">{q.subject || '—'}</td>
                  <td className="px-3 py-3 hidden lg:table-cell text-gray-500">{examTitle(q.exam_id)}</td>
                  <td className="px-3 py-3"><span className="capitalize text-gray-500">{q.difficulty || '—'}</span></td>
                  <td className="px-3 py-3"><span className={`badge ${statusBadge(q.status)}`}>{q.status}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(q)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(q.id)} className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2">{filtered.length} of {items.length} questions</p>

      {/* Add / Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Question' : 'Add Question'} maxWidth="max-w-2xl">
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">Question *</label>
            <textarea className="input" rows={2} value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            {['a', 'b', 'c', 'd'].map(o => (
              <div key={o}><label className="block text-sm font-medium mb-1">Option {o.toUpperCase()}</label>
                <input className="input" value={form[`option_${o}`]} onChange={e => setForm({ ...form, [`option_${o}`]: e.target.value })} /></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Correct *</label>
              <select className="input" value={form.correct_answer} onChange={e => setForm({ ...form, correct_answer: e.target.value })}>
                {['A', 'B', 'C', 'D'].map(x => <option key={x}>{x}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium mb-1">Difficulty</label>
              <select className="input" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Explanation</label>
            <textarea className="input" rows={2} value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Exam</label>
              <select className="input" value={form.exam_id} onChange={e => setForm({ ...form, exam_id: e.target.value })}>
                <option value="">— none (topic pool) —</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium mb-1">Test ID (legacy key)</label>
              <input className="input" placeholder="e.g. indian-polity" value={form.test_id} onChange={e => setForm({ ...form, test_id: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium mb-1">Subject</label>
              <input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Topic</label>
              <input className="input" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Subtopic</label>
              <input className="input" value={form.subtopic} onChange={e => setForm({ ...form, subtopic: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium mb-1">Language</label>
              <select className="input" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium mb-1">Source</label>
              <input className="input" placeholder="e.g. APPSC 2022" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Source Year</label>
              <input type="number" className="input" value={form.source_year} onChange={e => setForm({ ...form, source_year: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Tags (comma-sep)</label>
              <input className="input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Status</label>
              <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? 'Saving...' : editing ? 'Update Question' : 'Add Question'}
          </button>
        </div>
      </Modal>

      {/* Bulk import modal */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Bulk Import Questions" maxWidth="max-w-2xl">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Paste a JSON array. Each object needs at least <code>question</code> and <code>correct_answer</code> (A/B/C/D).
            Optional: option_a-d, explanation, subject, topic, subtopic, difficulty, test_id, source, source_year, tags.
            <b> All imported questions enter as drafts</b> — never auto-published.
          </p>
          <label className="btn-secondary text-sm cursor-pointer inline-flex w-fit">
            <FileSpreadsheet className="h-4 w-4" /> Load CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onCsvFile} />
          </label>
          <textarea className="input font-mono text-xs" rows={10} placeholder='[{"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A","subject":"Indian Polity","difficulty":"medium"}]'
            value={importText} onChange={e => setImportText(e.target.value)} />
          <button onClick={bulkImport} disabled={importing} className="btn-primary w-full justify-center">
            {importing ? 'Importing...' : 'Import as Drafts'}
          </button>
        </div>
      </Modal>

      {/* Phase 4: AI generate modal */}
      <Modal open={aiModal} onClose={() => setAiModal(false)} title="AI Generate Questions" maxWidth="max-w-lg">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Generates competitive-exam questions with AI and files them as <b>drafts</b> in
            the AI Drafts review queue. Nothing is published automatically — you review,
            validate, and publish there.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">How many</label>
              <select className="input" value={aiForm.count} onChange={e => setAiForm({ ...aiForm, count: e.target.value })}>
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium mb-1">Exam</label>
              <select className="input" value={aiForm.examSlug} onChange={e => setAiForm({ ...aiForm, examSlug: e.target.value })}>
                <option value="">— any —</option>
                {exams.map(e => <option key={e.id} value={e.slug}>{e.title}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Subject</label>
              <input className="input" placeholder="e.g. Indian Polity" value={aiForm.subject} onChange={e => setAiForm({ ...aiForm, subject: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Topic (optional)</label>
              <input className="input" placeholder="e.g. Fundamental Rights" value={aiForm.topic} onChange={e => setAiForm({ ...aiForm, topic: e.target.value })} /></div>
          </div>
          <button onClick={runAiGenerate} disabled={generating} className="btn-primary w-full justify-center">
            <Sparkles className="h-4 w-4" /> {generating ? 'Generating…' : 'Generate Drafts'}
          </button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
