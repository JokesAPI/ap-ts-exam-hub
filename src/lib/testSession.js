// ── Shared mock-test session persistence ─────────────────────────────────────
// Stores an in-progress exam-mode test (MockTestEngine) in localStorage so an
// interrupted test (refresh, tab close, crash) can be resumed. Used by:
//   - MockTestEngine.jsx  (save / restore / clear)
//   - MockTests.jsx       (resume banner)
//   - StudentDashboard.jsx (Continue Study → resume card)
//
// Sessions expire after 24h. Purely client-side — no DB writes per answer.

export const SESSION_KEY    = 'mock_session_v1'
export const SESSION_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || !s.testId || !Array.isArray(s.questions) || s.questions.length === 0) return null
    if (!s.savedAt || Date.now() - s.savedAt > SESSION_MAX_AGE) {
      clearSession()
      return null
    }
    return s
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, savedAt: Date.now() }))
  } catch { /* storage full / private mode — resume is best-effort */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}
