// ── Recently viewed papers (Phase 5) ─────────────────────────────────────────
// Client-side only (localStorage), mirroring src/lib/testSession.js. Stores a
// small list of recently opened previous papers so the public page and the
// student dashboard can surface them. No DB writes, no migration.

const KEY = 'recent_papers_v1'
const MAX = 8

export function getRecentPapers() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function addRecentPaper(paper) {
  if (!paper?.id) return
  try {
    const entry = {
      id: paper.id,
      title: paper.title,
      organization: paper.organization || null,
      year: paper.year || null,
      subject: paper.subject || null,
      pdf_url: paper.pdf_url || null,
      viewed_at: Date.now(),
    }
    const existing = getRecentPapers().filter(p => p.id !== paper.id)
    const next = [entry, ...existing].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* private mode / quota — best effort */ }
}

export function clearRecentPapers() {
  try { localStorage.removeItem(KEY) } catch {}
}
