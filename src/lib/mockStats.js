// ── Shared mock-test stat helpers ────────────────────────────────────────────
// Single source for percentage/formatting/recommendation logic reused by
// MockTestEngine, StudentDashboard, and the Previous Attempts page. Avoids the
// copy-pasted helpers that previously lived in each page.

import { SUBJECT_TO_TEST, TEST_TITLES } from './questions'

// Percentage for a saved mock_results row (prefers stored `percentage`,
// falls back to score/total for older rows).
export function attemptPct(a) {
  if (!a) return 0
  if (typeof a.percentage === 'number') return a.percentage
  return a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
}

export function pctColorClass(pct) {
  if (pct >= 70) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export function pctBarClass(pct) {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function pctBadgeClass(pct) {
  if (pct >= 70) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
}

export function formatDuration(secs) {
  const s = Math.max(0, Math.round(secs || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
}

// Aggregate subject stats across an array of saved attempts → sorted weakest-first.
export function aggregateSubjects(attempts) {
  const agg = {}
  for (const a of attempts || []) {
    for (const [subj, s] of Object.entries(a.subject_stats || {})) {
      if (!agg[subj]) agg[subj] = { correct: 0, wrong: 0, total: 0 }
      agg[subj].correct += s.correct || 0
      agg[subj].wrong   += s.wrong   || 0
      agg[subj].total   += s.total   || 0
    }
  }
  return Object.entries(agg)
    .map(([name, s]) => ({ name, ...s, pct: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)
}

// Recommend the test that drills the user's weakest subject (<70%), excluding
// an optional current test. Returns { recId, title, name, pct } or null.
export function recommendNextTest(attempts, excludeTestId = null) {
  const subjects = aggregateSubjects(attempts)
  const hit = subjects
    .map(w => ({ ...w, recId: SUBJECT_TO_TEST[w.name] }))
    .find(w => w.recId && w.recId !== excludeTestId && w.pct < 70)
  if (!hit) return null
  return { recId: hit.recId, title: TEST_TITLES[hit.recId], name: hit.name, pct: hit.pct }
}
