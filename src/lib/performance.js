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
 * @param {Array<{subject_stats: Object}>} attempts - as returned by
 *   loadSubjectStats(), each shaped { subject_stats: { [subject]: { correct, wrong, total } }, test_id, created_at }
 * @returns {{ subject: string, correct: number, wrong: number, total: number, accuracy: number } | null}
 */
export function getWeakestSubject(attempts) {
  const totals = {}

  for (const attempt of attempts || []) {
    for (const [subject, s] of Object.entries(attempt?.subject_stats || {})) {
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
 * @param {Array<{subject_stats: Object}>} attempts - as returned by loadSubjectStats()
 * @param {Array<Object>} testCatalog - result of loadTestCatalog(supabase)
 * @returns {{ subject: string, accuracy: number, test: Object } | null}
 */
export function getStudyGoal(attempts, testCatalog) {
  const weakest = getWeakestSubject(attempts)
  if (!weakest) return null

  const test = (testCatalog || []).find(t => t.subject === weakest.subject)
  if (!test) return null

  return { subject: weakest.subject, accuracy: weakest.accuracy, test }
}

/**
 * Whether the signed-in student has already submitted an attempt on the
 * given test today (local date). This is the only source of truth for
 * "mission completed" -- a real mock_results row, not a separately-tracked
 * flag, so there is nothing to reset or fall out of sync with midnight
 * rollover: today's date is recomputed on every call.
 *
 * @param {Array<{test_id: string, created_at: string}>} attempts - as returned by loadSubjectStats()
 * @param {string} testId
 * @returns {boolean}
 */
export function isCompletedToday(attempts, testId) {
  if (!testId) return false
  const today = new Date().toDateString()
  return (attempts || []).some(a => a.test_id === testId && new Date(a.created_at).toDateString() === today)
}

/** Seconds assumed per question for the mission card's time estimate --
 *  a pacing assumption, not measured data; question count and difficulty
 *  mix are real. */
const SECONDS_PER_QUESTION = 45

/**
 * Turns a test's real published-question metadata into the mission card's
 * "Estimated Time" and "Difficulty" fields. Never invents a test's
 * difficulty or length -- both come from the caller's own query against
 * mock_questions for that one test_id.
 *
 * @param {Array<{difficulty: string}>} questionMeta - published questions
 *   for the recommended test (difficulty column only)
 * @returns {{ estimatedMinutes: number, difficulty: string } | null}
 *   null when there's no question data to base an estimate on
 */
export function getMissionDetails(questionMeta) {
  const rows = (questionMeta || []).filter(q => q && q.difficulty)
  if (rows.length === 0) return null

  const counts = {}
  for (const q of rows) counts[q.difficulty] = (counts[q.difficulty] || 0) + 1
  const difficulty = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]

  const estimatedMinutes = Math.max(1, Math.round((rows.length * SECONDS_PER_QUESTION) / 60))

  return { estimatedMinutes, difficulty }
}
