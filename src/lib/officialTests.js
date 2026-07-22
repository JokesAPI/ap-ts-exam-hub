// ── Official Mock Tests — Supabase-only data layer (Phase 4.0 / PR-2) ────────
//
// Official tests come from the DB and NOWHERE else. There is deliberately no
// fallback to the hardcoded QUESTION_BANK: a silent fallback is what allowed the
// dual source of truth to survive unnoticed. If Supabase fails, we throw and the
// caller shows an explicit error rather than serving stale/unreviewed questions.
//
// Access is enforced server-side by RLS (PR-1). The helpers below only decide
// which CTA to render — they are UX, never security. A client that ignores them
// still receives zero rows from the database.

/** Access tiers, ordered least → most privileged. */
export const TIERS = { PUBLIC: 'public', FREE: 'free', PREMIUM: 'premium' }

/**
 * What a given viewer may do with a given test.
 * Returns 'start' | 'login' | 'upgrade'.
 *   public  → anyone
 *   free    → any signed-in user
 *   premium → active subscriber only
 */
export function resolveAccess(tier, { user, isPro }) {
  if (tier === TIERS.PUBLIC) return 'start'
  if (tier === TIERS.FREE) return user ? 'start' : 'login'
  if (tier === TIERS.PREMIUM) {
    if (!user) return 'login'
    return isPro ? 'start' : 'upgrade'
  }
  // Unknown tier: fail closed.
  return 'upgrade'
}

/** The official test catalog. Readable by everyone (premium tests must be seen to be sold). */
export async function loadTestCatalog(supabase) {
  const { data, error } = await supabase
    .from('mock_tests')
    // Phase 7.5A: duration_minutes / negative_mark_per_wrong are nullable
    // per-test overrides. NULL on either means "not set" -- callers must
    // fall back to the legacy hardcoded behaviour, never treat NULL as 0.
    .select('test_id, title, description, access_tier, subject, display_order, duration_minutes, negative_mark_per_wrong')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw new Error(`Could not load the test catalog: ${error.message}`)
  return data || []
}

/** A single test's metadata (used by the engine to gate before fetching questions). */
export async function loadTest(supabase, testId) {
  const { data, error } = await supabase
    .from('mock_tests')
    // Phase 7.5A: same nullable-override columns as loadTestCatalog() above.
    .select('test_id, title, access_tier, subject, duration_minutes, negative_mark_per_wrong')
    .eq('test_id', testId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Could not load the test: ${error.message}`)
  return data // null when the test doesn't exist
}

/**
 * Published questions for an official test.
 * RLS filters by access_tier, so a viewer who lacks access simply gets no rows —
 * we surface that as an explicit, honest error instead of substituting content.
 */
export async function loadOfficialQuestions(supabase, testId) {
  const { data, error } = await supabase
    .from('mock_questions')
    .select('id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, subject, topic, difficulty')
    .eq('test_id', testId)
    .eq('status', 'published')

  if (error) throw new Error(`Could not load questions: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error('No questions are available for this test yet.')
  }
  return data
}
