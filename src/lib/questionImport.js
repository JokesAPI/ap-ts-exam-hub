// Phase 8.1 -- pure bulk-import resolution/validation logic, extracted out
// of AdminQuestions.jsx's bulkImport() so tests exercise the real
// production functions instead of a copied duplicate.
//
// No Supabase calls, no React state, no UI -- those all stay in
// AdminQuestions.jsx, which imports and calls these functions directly.
//
// The Subject -> test_id mapping itself is NOT duplicated here: it's
// imported from the one centralized src/config/subjectTestMap.js, per the
// approved Phase 8.1 architecture (Design B).

import { SUBJECT_TEST_MAP } from '../config/subjectTestMap.js'

/**
 * Resolve one bulk-import row's target test_id.
 *
 * Precedence (explicit test_id always wins, unchanged from Phase 8.0):
 *   1. row.test_id
 *   2. row.mock_test_assignment   (legacy compatibility field)
 *   3. SUBJECT_TEST_MAP[row.subject]   (Phase 8.1 default routing)
 *
 * Returns { testId } on success, or { error } on failure -- never both.
 */
export function resolveImportTestId(row, validTestIds) {
  const testIdSource = row.test_id ?? row.mock_test_assignment
  let testId = testIdSource == null ? '' : String(testIdSource).trim()

  if (!testId) {
    const subj = (row.subject ?? '').toString().trim()
    if (!subj) {
      return { error: 'test_id is required (must match an existing Mock Test), or subject must be set so it can be resolved automatically' }
    }
    const mapped = SUBJECT_TEST_MAP[subj]
    if (!mapped) {
      return { error: `unknown subject "${subj}" — expected one of: ${Object.keys(SUBJECT_TEST_MAP).join(', ')}` }
    }
    testId = mapped
  }

  if (!validTestIds.has(testId)) {
    return { error: `unknown test_id "${testId}" — must match an existing Mock Test` }
  }
  return { testId }
}

/**
 * Structural validation of one raw bulk-import row (question text, correct
 * answer, all four options), independent of test_id resolution.
 * Returns an error string, or null if the row's shape is valid.
 */
export function validateImportRowShape(row) {
  if (!row.question || !['A', 'B', 'C', 'D'].includes(row.correct_answer)) {
    return 'missing question or invalid correct_answer'
  }
  if (!row.option_a || !row.option_b || !row.option_c || !row.option_d) {
    return 'all four options (option_a-option_d) are required'
  }
  return null
}

/**
 * Normalize one already-resolved bulk-import row into the shape
 * buildPayload() expects.
 *
 * Bulk import NEVER trusts an incoming status or difficulty value:
 *   - status is always forced to the exact lowercase 'draft', regardless
 *     of input casing (Draft / DRAFT / draft all normalize the same way).
 *     Import can never publish a question or set any other status.
 *   - difficulty is always forced to null. Bulk-imported questions never
 *     carry an easy/medium/hard classification, even if a legacy row
 *     supplies one -- difficulty is retired from the import workflow
 *     entirely, not merely defaulted.
 *
 * This deliberately differs from the manual Add/Edit Question form
 * (save()'s own buildPayload() call in AdminQuestions.jsx), which still
 * lets an admin pick a difficulty by hand -- that workflow is untouched.
 */
export function normalizeImportRow(row, testId) {
  return {
    ...row,
    test_id: testId,
    tags: Array.isArray(row.tags) ? row.tags.join(', ') : (row.tags || ''),
    status: 'draft',
    difficulty: null,
  }
}

/**
 * Validate an entire bulk-import batch.
 *
 * Bulk import is all-or-nothing: if ANY row fails validation (test_id/
 * subject resolution or structural shape), the whole batch is rejected --
 * `rows` is always empty in that case, never a partial list of the rows
 * that happened to pass. This exists specifically so an Enterprise
 * QuestionBank batch can never produce an incomplete production import;
 * the caller must not insert anything when `errors.length > 0`.
 *
 * Returns:
 *   { rows: [...normalized rows, ready for buildPayload...], errors: [] }
 *   or
 *   { rows: [], errors: [{ row, reason }, ...] }   (nothing importable)
 */
export function validateImportRows(rawRows, validTestIds) {
  const errors = []
  const normalized = []

  rawRows.forEach((row, i) => {
    const rowNum = i + 1
    const { testId, error: testIdError } = resolveImportTestId(row, validTestIds)
    if (testIdError) { errors.push({ row: rowNum, reason: testIdError }); return }

    const shapeError = validateImportRowShape(row)
    if (shapeError) { errors.push({ row: rowNum, reason: shapeError }); return }

    normalized.push(normalizeImportRow(row, testId))
  })

  if (errors.length > 0) return { rows: [], errors }
  return { rows: normalized, errors: [] }
}
