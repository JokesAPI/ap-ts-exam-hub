// ── Attempt History — Supabase data layer (Phase 6.3.1C) ─────────────────────
//
// Isolation is enforced server-side by RLS: policy `mock_results_own` restricts
// every command on mock_results to `auth.uid() = user_id`, and `anon` holds no
// grants on the table at all. The .eq('user_id', ...) below is defence in depth
// and a query-planner hint (it matches idx_mock_results_user_created) — it is
// NOT the security boundary. A client that removes it still receives only its
// own rows.
//
// Column selection is explicit and deliberate. `answers` and `subject_stats`
// are large jsonb blobs (a full question snapshot per attempt, ~2 KB for a
// 10-question test and growing linearly with question count). Neither is
// rendered in the list, so neither is fetched.

/** Attempts per page. */
export const PAGE_SIZE = 10

/** Only the columns the history table actually renders. */
const LIST_COLUMNS = 'id, test_id, test_title, score, total, percentage, time_taken, created_at'

/**
 * One page of the signed-in student's attempts, newest first.
 *
 * @param supabase  the shared client
 * @param userId    auth user id
 * @param page      0-indexed
 * @param search    optional test-title substring
 * @returns { rows, total }
 */
export async function loadAttemptPage(supabase, { userId, page = 0, search = '' } = {}) {
  let query = supabase
    .from('mock_results')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)

  const term = search.trim()
  if (term) query = query.ilike('test_title', `%${term}%`)

  const from = page * PAGE_SIZE
  const { data, error, count } = await query
    // created_at DESC matches idx_mock_results_user_created; id is a stable
    // tiebreak so two attempts saved in the same millisecond cannot swap
    // position between pages.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw new Error(`Could not load your attempts: ${error.message}`)
  return { rows: data || [], total: count ?? 0 }
}

/**
 * test_id → exam name, for the Exam column.
 *
 * mock_results.test_id has no foreign key to mock_tests, so PostgREST cannot
 * embed the relationship. The catalog is tiny (8 active tests, 29 exams), so we
 * fetch it once per page load and join in memory rather than adding a schema
 * change to this phase.
 *
 * Note: `mock_tests_select_public` exposes only rows with is_active = true, so
 * an attempt on a retired test simply resolves to null and renders as "—". The
 * attempt itself still lists, which is the desired behaviour for history.
 */
export async function loadExamLookup(supabase) {
  const [tests, exams] = await Promise.all([
    supabase.from('mock_tests').select('test_id, exam_id'),
    supabase.from('exams').select('id, exam_name'),
  ])
  if (tests.error) throw new Error(`Could not load the test catalog: ${tests.error.message}`)
  if (exams.error) throw new Error(`Could not load exams: ${exams.error.message}`)

  const examById = new Map((exams.data || []).map(e => [e.id, e.exam_name]))
  return new Map(
    (tests.data || []).map(t => [t.test_id, t.exam_id ? examById.get(t.exam_id) || null : null])
  )
}

/** Seconds → m:ss, for the Time Taken column. */
export function formatDuration(secs) {
  if (typeof secs !== 'number' || secs < 0) return '—'
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Every subject_stats blob from the signed-in student's own attempts, full
 * history (not paginated like loadAttemptPage -- a weak-subject calculation
 * needs the whole history, not one page of it).
 *
 * subject_stats is small: measured at ~95-101 bytes/row in production,
 * unlike `answers` (~2 KB/row, grows with question count). Fetching it in
 * full for one student, even across 100+ attempts, stays well under the
 * size that made `answers`/`subject_stats` worth excluding from
 * loadAttemptPage's LIST_COLUMNS in the first place -- that exclusion was
 * about `answers`, not this column.
 *
 * Same RLS boundary as every other query in this file: mock_results_select_own
 * restricts every row to auth.uid() = user_id regardless of this .eq() --
 * the filter here is a query-planner hint (matches idx_mock_results_user_id),
 * not the security boundary.
 *
 * @returns Array<Object> - one subject_stats blob per attempt that has one,
 *   shaped { [subject]: { correct, wrong, total } }
 */
export async function loadSubjectStats(supabase, userId) {
  const { data, error } = await supabase
    .from('mock_results')
    .select('subject_stats')
    .eq('user_id', userId)
    .not('subject_stats', 'is', null)

  if (error) throw new Error(`Could not load subject performance: ${error.message}`)
  return (data || []).map(row => row.subject_stats).filter(Boolean)
}
