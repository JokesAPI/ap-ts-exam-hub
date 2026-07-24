// Phase 8.3 -- pure content-validation logic shared by Manual Create, Manual
// Edit, Bulk Import, and Publish in src/pages/admin/AdminQuestions.jsx.
//
// No Supabase calls, no React state, no browser APIs, no global state --
// exactly the src/lib/questionImport.js convention. Callers own every
// Supabase read/write; this module only ever receives and returns plain
// data.
//
// Duplicate policy (3-tier, unchanged across Create/Edit/Import/Publish):
//   Tier A (exact/normalized)   -- findExactDuplicate/findExactDuplicates.
//                                  Callers block the write on a match.
//   Tier B (near-duplicate)     -- backed by the find_near_duplicate_questions
//                                  RPC (see supabase/migrations/
//                                  20260724120000_phase8_3c_duplicate_detection.sql).
//                                  formatNearDuplicateWarnings() only reshapes
//                                  the RPC's rows -- it never decides whether
//                                  to block. Callers must never block a write
//                                  on a Tier B result by itself.
//   Tier C (cross-subject/curriculum reuse) -- no function here. Both Tier A
//                                  and Tier B only ever compare within a
//                                  single test_id, because the caller is
//                                  responsible for scoping `existingQuestions`
//                                  (Tier A) and `p_test_id` (Tier B, at the
//                                  RPC call site) to one test_id before
//                                  calling into this module. Legitimate reuse
//                                  across test_id is allowed simply by never
//                                  being compared.

/**
 * Normalize question text for Tier A exact/normalized-duplicate comparison.
 *
 * - null/undefined become '' (never throws on a missing question field)
 * - leading/trailing whitespace trimmed
 * - any internal whitespace run (spaces, tabs, newlines) collapsed to one space
 * - lowercased
 * - punctuation and numbers are left exactly as written -- this is
 *   normalization for exact/near-typo matching, not semantic comparison
 *
 * @param {*} text
 * @returns {string}
 */
export function normalizeQuestionText(text) {
  if (text == null) return ''
  return String(text).trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Tier A: does `inputQuestion` exactly (post-normalization) match any record
 * in `existingQuestions`?
 *
 * `existingQuestions` must already be scoped to the same test_id by the
 * caller -- this function does not read, compare, or infer test_id itself.
 *
 * An empty normalized value never matches anything, on either side: if
 * `inputQuestion` normalizes to '', this returns null immediately without
 * scanning `existingQuestions`; and any existing record whose `question`
 * normalizes to '' (a malformed/blank row) is skipped rather than treated
 * as a candidate. This is a safe-comparison guard, not throwing validation
 * -- a blank question is still expected to be rejected by the caller's own
 * required-field checks (e.g. AdminQuestions.jsx's save()/questionImport.js's
 * validateImportRowShape()); this function just refuses to let two blanks
 * present as a "duplicate" of each other.
 *
 * @param {string} inputQuestion
 * @param {Array<{id: string, question: string}>} existingQuestions
 * @param {{excludeId?: string}} [options] - excludeId skips a record with a
 *   matching id, e.g. so Manual Edit doesn't flag a question against itself.
 * @returns {object|null} the matching existing question object, or null.
 *   Never mutates inputQuestion or existingQuestions.
 */
export function findExactDuplicate(inputQuestion, existingQuestions, options = {}) {
  const { excludeId } = options
  const normalizedInput = normalizeQuestionText(inputQuestion)
  if (!normalizedInput) return null
  for (const existing of existingQuestions) {
    if (excludeId != null && existing.id === excludeId) continue
    const normalizedExisting = normalizeQuestionText(existing.question)
    if (!normalizedExisting) continue
    if (normalizedExisting === normalizedInput) return existing
  }
  return null
}

/**
 * Batch form of findExactDuplicate, for Bulk Import.
 *
 * No excludeId/options param: Bulk Import only ever inserts new rows, it
 * never edits an existing one, so there is nothing to self-exclude here --
 * kept minimal rather than carrying an unused parameter.
 *
 * Detects two distinct kinds of Tier A conflict, in this priority order per
 * input row:
 *   1. 'existing' -- the row matches a record already in `existingQuestions`
 *      (via findExactDuplicate, so the empty-normalized-value guard from
 *      Fix 1 applies here too).
 *   2. 'batch'     -- the row has no existing-DB match, but matches an
 *      EARLIER row in the same `inputQuestions` array. Rows are scanned in
 *      ascending index order and the first occurrence of any given
 *      normalized text is never itself flagged -- only later repeats of it
 *      are, and they always reference that first occurrence (not whichever
 *      repeat immediately preceded them), so results stay deterministic
 *      regardless of how many repeats exist.
 * A row whose normalized text is empty is skipped entirely -- consistent
 * with Fix 1, an empty/whitespace-only row is never compared or recorded
 * as a "first occurrence" either.
 *
 * Order matches input order (ascending index), so results are
 * deterministic.
 *
 * @param {string[]} inputQuestions
 * @param {Array<{id: string, question: string}>} existingQuestions
 * @returns {Array<{
 *   index: number,
 *   inputQuestion: string,
 *   conflictType: 'existing'|'batch',
 *   matched: object|null,
 *   matchedInputIndex: number|null,
 *   matchedInputQuestion: string|null,
 * }>}
 */
export function findExactDuplicates(inputQuestions, existingQuestions) {
  const conflicts = []
  const firstOccurrenceByNormalized = new Map() // normalized text -> { index, inputQuestion }

  inputQuestions.forEach((inputQuestion, index) => {
    const normalized = normalizeQuestionText(inputQuestion)
    if (!normalized) return // Fix 1 parity: never compared, never recorded as a first occurrence

    const existingMatch = findExactDuplicate(inputQuestion, existingQuestions)
    if (existingMatch) {
      conflicts.push({
        index,
        inputQuestion,
        conflictType: 'existing',
        matched: existingMatch,
        matchedInputIndex: null,
        matchedInputQuestion: null,
      })
    } else {
      const firstOccurrence = firstOccurrenceByNormalized.get(normalized)
      if (firstOccurrence) {
        conflicts.push({
          index,
          inputQuestion,
          conflictType: 'batch',
          matched: null,
          matchedInputIndex: firstOccurrence.index,
          matchedInputQuestion: firstOccurrence.inputQuestion,
        })
      }
    }

    if (!firstOccurrenceByNormalized.has(normalized)) {
      firstOccurrenceByNormalized.set(normalized, { index, inputQuestion })
    }
  })

  return conflicts
}

/**
 * Strictly parses a raw Tier B similarity value.
 *
 * Only `number` and `string` inputs are ever considered -- anything else
 * (null, undefined, boolean, object, array) is rejected outright, so
 * `null` can never fall through to `Number(null) === 0` the way a naive
 * `Number(x)` coercion would. A string is trimmed first; an empty or
 * whitespace-only string is rejected before any numeric parse is
 * attempted. The parsed/typed value must be finite -- NaN, Infinity, and
 * -Infinity are all rejected, matching the RPC's declared `real` column
 * (it should never itself produce these, but this function does not trust
 * that and checks anyway).
 *
 * @param {*} raw
 * @returns {{valid: true, value: number} | {valid: false}}
 */
function parseSimilarity(raw) {
  let num
  if (typeof raw === 'number') {
    num = raw
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return { valid: false }
    num = Number(trimmed)
  } else {
    return { valid: false }
  }
  if (!Number.isFinite(num)) return { valid: false }
  return { valid: true, value: num }
}

/**
 * Pure formatter for Tier B: reshapes find_near_duplicate_questions() RPC
 * rows (snake_case DB columns) into a stable camelCase warning structure.
 *
 * Does not call Supabase, does not apply or re-check any threshold (the RPC
 * already applied p_threshold via set_limit()), and does not decide
 * blocking behavior -- callers must treat every result as warning-only.
 *
 * A row is dropped entirely (not included with a placeholder value) if its
 * `similarity` is not a finite number after parsing -- null, undefined,
 * '', whitespace-only, a non-numeric string, NaN, Infinity, and -Infinity
 * are all rejected this way. A valid numeric string (e.g. '0.62') is
 * converted to a real number. This function never returns NaN, and never
 * silently turns a missing/invalid value into 0.
 *
 * @param {*} rpcRows - expected shape: Array<{input_question, matched_id,
 *   matched_question, matched_status, similarity}>. Anything that isn't an
 *   array (null, undefined, or otherwise) returns [].
 * @returns {Array<{inputQuestion, matchedId, matchedQuestion, matchedStatus, similarity: number}>}
 */
export function formatNearDuplicateWarnings(rpcRows) {
  if (!Array.isArray(rpcRows)) return []
  const warnings = []
  for (const row of rpcRows) {
    const parsed = parseSimilarity(row?.similarity)
    if (!parsed.valid) continue
    warnings.push({
      inputQuestion: row.input_question,
      matchedId: row.matched_id,
      matchedQuestion: row.matched_question,
      matchedStatus: row.matched_status,
      similarity: parsed.value,
    })
  }
  return warnings
}
