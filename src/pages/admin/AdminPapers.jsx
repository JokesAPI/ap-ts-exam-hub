import { useEffect, useState } from 'react'
import { Trash2, Pencil, Plus, Upload } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const orgs = ['APPSC', 'TSPSC', 'AP Police', 'TS Police', 'DSC', 'RRB', 'SSC', 'Other']
const empty = { title: '', organization: '', year: '', subject: '', description: '', pdf_url: '' }

export default function AdminPapers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)

  const load = () => {
    setLoading(true)
    supabase.from('previous_papers').select('*').order('year', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [])

  function openAdd() { setForm(empty); setEditing(null); setFile(null); setModal(true) }
  function openEdit(item) { setForm(item); setEditing(item.id); setFile(null); setModal(true) }

  async function uploadPdf() {
    if (!file) return form.pdf_url
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `papers/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('previous-papers').upload(path, file)
    setUploading(false)
    if (error) { toast.error('Upload failed: ' + error.message); return null }
    const { data } = supabase.storage.from('previous-papers').getPublicUrl(path)
    return data.publicUrl
  }

  async function save() {
    setSaving(true)
    if (!form.title.trim()) { toast.error('Title required'); setSaving(false); return }
    const pdf_url = await uploadPdf()
    if (pdf_url === null) { setSaving(false); return }
    const payload = { ...form, pdf_url: pdf_url || form.pdf_url, year: form.year ? Number(form.year) : null }
    let err
    if (editing) {
      ({ error: err } = await supabase.from('previous_papers').update(payload).eq('id', editing))
    } else {
      ({ error: err } = await supabase.from('previous_papers').insert([payload]))
    }
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success(editing ? 'Updated!' : 'Added!')
    setModal(false); load()
  }

  async function remove(id) {
    if (!confirm('Delete this paper?')) return
    await supabase.from('previous_papers').delete().eq('id', id)
    toast.success('Deleted'); load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Previous Papers</h1>
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
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Year</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">PDF</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No papers yet.</td></tr>
              ) : items.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{p.organization || '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{p.year || '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.pdf_url ? <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs">View PDF</a> : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Paper' : 'Add Paper'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Title *</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Organization</label>
              <select className="input" value={form.organization || ''} onChange={e => setForm({...form, organization: e.target.value})}>
                <option value="">Select</option>{orgs.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Year</label><input type="number" className="input" placeholder="2024" value={form.year || ''} onChange={e => setForm({...form, year: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Subject</label><input className="input" placeholder="General Studies, Maths..." value={form.subject || ''} onChange={e => setForm({...form, subject: e.target.value})} /></div>
          <div><label className="block text-sm font-medium mb-1">Description</label><textarea className="input resize-none" rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div>
            <label className="block text-sm font-medium mb-1">Upload PDF</label>
            <label className="flex items-center gap-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-primary-400 transition-colors">
              <Upload className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium">{file ? file.name : 'Choose PDF file'}</p>
                <p className="text-xs text-gray-400">or paste URL below</p>
              </div>
              <input type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
          </div>
          <div><label className="block text-sm font-medium mb-1">PDF URL (if already uploaded)</label><input className="input" placeholder="https://..." value={form.pdf_url || ''} onChange={e => setForm({...form, pdf_url: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving || uploading} className="btn-primary disabled:opacity-60">
              {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
