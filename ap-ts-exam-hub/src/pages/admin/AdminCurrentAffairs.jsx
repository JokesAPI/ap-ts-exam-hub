import { useEffect, useState } from 'react'
import { Trash2, Pencil, Plus } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const cats = ['National', 'State AP', 'State TS', 'Economy', 'Science & Tech', 'Sports', 'Awards', 'International']
const empty = { title: '', content: '', category: '', published_date: new Date().toISOString().slice(0,10) }

export default function AdminCurrentAffairs() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    supabase.from('current_affairs').select('*').order('published_date', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [])

  function openAdd() { setForm({...empty, published_date: new Date().toISOString().slice(0,10)}); setEditing(null); setModal(true) }
  function openEdit(item) { setForm({...item, published_date: item.published_date?.slice(0,10) || ''}); setEditing(item.id); setModal(true) }

  async function save() {
    setSaving(true)
    if (!form.title.trim()) { toast.error('Title required'); setSaving(false); return }
    let err
    if (editing) {
      ({ error: err } = await supabase.from('current_affairs').update(form).eq('id', editing))
    } else {
      ({ error: err } = await supabase.from('current_affairs').insert([form]))
    }
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success(editing ? 'Updated!' : 'Added!')
    setModal(false); load()
  }

  async function remove(id) {
    if (!confirm('Delete this article?')) return
    await supabase.from('current_affairs').delete().eq('id', id)
    toast.success('Deleted'); load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Current Affairs</h1>
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
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No articles yet.</td></tr>
              ) : items.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{a.category || '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{a.published_date ? new Date(a.published_date).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(a.id)} className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Article' : 'Add Article'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Title *</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Category</label>
              <select className="input" value={form.category || ''} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="">Select</option>{cats.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Published Date</label><input type="date" className="input" value={form.published_date} onChange={e => setForm({...form, published_date: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Content</label><textarea className="input resize-none" rows={5} value={form.content || ''} onChange={e => setForm({...form, content: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
