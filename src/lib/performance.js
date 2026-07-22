// ── Weak-subject calculation & rule-based study recommendation ──────────────
//
// Pure functions, no I/O. Callers fetch the data (loadSubjectStats,
// loadTestCatalog) and pass it in here -- this file only aggregates and
// matches, so the same logic can be reused anywhere it's needed without
// duplicating the calculation.
//
// No AI. Every recommendation is a direct lookup against data the caller
// already fetched. If there's nothing real to recommend, these functions
// return null -- callers are expected to render nothing in that case,
// never a "no data" placeholder.

/**
 * Aggregates subject_stats across every attempt and returns the subject
 * with the lowest accuracy, requiring at least one answered (correct+wrong
 * > 0) question in that subject. Ties are broken by whichever subject is
 * encountered first -- there is no meaningful secondary ordering to prefer.
 *
 * @param {Array<Object>} subjectStatsList - blobs shaped
 *   { [subject]: { correct, wrong, total } }, as returned by
 *   loadSubjectStats()
 * @returns {{ subject: string, correct: number, wrong: number, total: number, accuracy: number } | null}
 */
export function getWeakestSubject(subjectStatsList) {
  const totals = {}

  for (const stats of subjectStatsList || []) {
    for (const [subject, s] of Object.entries(stats || {})) {
      if (!subject || !s) continue
      if (!totals[subject]) totals[subject] = { correct: 0, wrong: 0, total: 0 }
      totals[subject].correct += s.correct || 0
      totals[subject].wrong += s.wrong || 0
      totals[subject].total += s.total || 0
    }
  }

  let weakest = null
  for (const [subject, t] of Object.entries(totals)) {
    const answered = t.correct + t.wrong
    if (answered <= 0) continue
    const accuracy = Math.round((t.correct / answered) * 100)
    if (!weakest || accuracy < weakest.accuracy) {
      weakest = { subject, correct: t.correct, wrong: t.wrong, total: t.total, accuracy }
    }
  }
  return weakest
}

/**
 * Resolves today's study goal: the weakest subject plus a matching active
 * mock test, if one exists in the caller's already-loaded catalog. Reuses
 * whatever catalog the caller passes in (expected to be the result of
 * officialTests.js's loadTestCatalog(), which already filters is_active) --
 * this function never queries anything itself and never invents a test
 * that isn't in the catalog it was given.
 *
 * @param {Array<Object>} subjectStatsList
 * @param {Array<Object>} testCatalog - result of loadTestCatalog(supabase)
 * @returns {{ subject: string, accuracy: number, test: Object } | null}
 */
export function getStudyGoal(subjectStatsList, testCatalog) {
  const weakest = getWeakestSubject(subjectStatsList)
  if (!weakest) return null

  const test = (testCatalog || []).find(t => t.subject === weakest.subject)
  if (!test) return null

  return { subject: weakest.subject, accuracy: weakest.accuracy, test }
}
