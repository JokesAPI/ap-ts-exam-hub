import { useEffect, useState } from 'react'
import { Trash2, Pencil, Plus } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const empty = { title: '', organization: '', description: '', exam_date: '', last_date: '', status: 'Upcoming', notification_url: '' }
const orgs = ['APPSC', 'TSPSC', 'AP Police', 'TS Police', 'DSC', 'RRB', 'SSC', 'Other']
const statuses = ['Upcoming', 'Open', 'Closed', 'Postponed']

export default function AdminExams() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    supabase.from('exams').select('*').order('exam_date', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [])

  function openAdd() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(item) { setForm({...item, exam_date: item.exam_date?.slice(0,10) || '', last_date: item.last_date?.slice(0,10) || ''}); setEditing(item.id); setModal(true) }

  async function save() {
    setSaving(true)
    if (!form.title.trim()) { toast.error('Title is required'); setSaving(false); return }
    const payload = { ...form, exam_date: form.exam_date || null, last_date: form.last_date || null }
    let err
    if (editing) {
      ({ error: err } = await supabase.from('exams').update(payload).eq('id', editing))
    } else {
      // exam_name is NOT NULL in the database; slug is required by downstream
      // features (e.g. AdminQuestions filters on slug IS NOT NULL). Both are
      // derived from the same validated title so there's one source of truth.
      const slug = form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const insertPayload = { ...payload, exam_name: form.title.trim(), slug };
      ({ error: err } = await supabase.from('exams').insert([insertPayload]))
    }
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success(editing ? 'Updated!' : 'Added!')
    setModal(false)
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this exam?')) return
    const { error } = await supabase.from('exams').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted'); load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Exams</h1>
        <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Org</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No exams yet.</td></tr>
              ) : items.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{e.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{e.organization}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{e.exam_date ? new Date(e.exam_date).toLocaleDateString('en-IN') : 'TBA'}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{e.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(e.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Exam' : 'Add Exam'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Title *</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Organization</label>
              <select className="input" value={form.organization} onChange={e => setForm({...form, organization: e.target.value})}>
                <option value="">Select</option>{orgs.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Status</label>
              <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Description</label><textarea className="input resize-none" rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Exam Date</label><input type="date" className="input" value={form.exam_date} onChange={e => setForm({...form, exam_date: e.target.value})} /></div>
            <div><label className="block text-sm font-medium mb-1">Last Date to Apply</label><input type="date" className="input" value={form.last_date} onChange={e => setForm({...form, last_date: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Official Notification URL</label><input className="input" placeholder="https://..." value={form.notification_url || ''} onChange={e => setForm({...form, notification_url: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
