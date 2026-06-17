import { useEffect, useState } from 'react'
import { Trash2, Pencil, Plus } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const empty = { title: '', description: '', category: '', link: '', is_important: false }

export default function AdminNotifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    supabase.from('notifications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }

  useEffect(load, [])

  function openAdd() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(item) { setForm(item); setEditing(item.id); setModal(true) }

  async function save() {
    setSaving(true)
    const { title, description, category, link, is_important } = form
    if (!title.trim()) { toast.error('Title is required'); setSaving(false); return }
    let err
    if (editing) {
      ({ error: err } = await supabase.from('notifications').update({ title, description, category, link, is_important }).eq('id', editing))
    } else {
      ({ error: err } = await supabase.from('notifications').insert([{ title, description, category, link, is_important }]))
    }
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success(editing ? 'Updated!' : 'Added!')
    setModal(false)
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this notification?')) return
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
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
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Category</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Important</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No notifications yet.</td></tr>
              ) : items.map(n => (
                <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{n.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{n.category || '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{n.is_important ? <span className="badge bg-red-100 text-red-600">Yes</span> : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(n)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(n.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Notification' : 'Add Notification'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select className="input" value={form.category || ''} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="">None</option>
                {['Notification', 'Result', 'Admit Card', 'Answer Key', 'Syllabus', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">External Link</label>
              <input className="input" placeholder="https://..." value={form.link || ''} onChange={e => setForm({...form, link: e.target.value})} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.is_important || false} onChange={e => setForm({...form, is_important: e.target.checked})} />
            <span className="text-sm font-medium">Mark as Important</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
