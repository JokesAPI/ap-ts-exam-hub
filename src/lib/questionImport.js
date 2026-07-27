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
import { findExactDuplicates } from './contentValidation.js'

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
 * Look up the existing-questions array for one resolved test_id inside
 * `existingQuestionsByTestId`, which callers may supply as either a plain
 * object or a Map (both keyed by the exact resolved test_id string).
 *
 * Deliberately defensive, regardless of how the caller built the lookup:
 *   - a missing key returns []
 *   - any non-array value at that key returns [] rather than being passed
 *     through -- this also makes prototype-chain reads safe (e.g. a plain
 *     `{}` lookup with testId === 'constructor' or 'toString' resolves to
 *     an inherited function, not an array, so it's rejected here) even if
 *     the caller didn't build the object with Object.create(null)
 *   - a non-object, non-Map top-level argument (string, number, null,
 *     undefined, boolean) returns [] for every testId
 * Never throws, never mutates its arguments.
 */
function getExistingQuestionsForTestId(existingQuestionsByTestId, testId) {
  if (existingQuestionsByTestId instanceof Map) {
    const value = existingQuestionsByTestId.get(testId)
    return Array.isArray(value) ? value : []
  }
  if (existingQuestionsByTestId && typeof existingQuestionsByTestId === 'object') {
    const value = existingQuestionsByTestId[testId]
    return Array.isArray(value) ? value : []
  }
  return []
}

/**
 * Validate an entire bulk-import batch.
 *
 * Bulk import is all-or-nothing: if ANY row fails validation (test_id/
 * subject resolution, structural shape, or -- Phase 8.3 -- Tier A exact/
 * normalized duplicate detection), the whole batch is rejected -- `rows`
 * is always empty in that case, never a partial list of the rows that
 * happened to pass. This exists specifically so an Enterprise QuestionBank
 * batch can never produce an incomplete production import; the caller
 * must not insert anything when `errors.length > 0`.
 *
 * Phase 8.3: `existingQuestionsByTestId` (default `{}`, so the previous
 * two-argument call shape is unchanged) is a lookup -- plain object or
 * Map, either is supported -- of already-existing DB questions per
 * resolved test_id, e.g. `{ "indian-polity": [{id, test_id, question}] }`.
 * Only rows that already passed routing and shape validation are checked
 * for duplicates, grouped by their resolved test_id (preserving each
 * row's original position within its group), and handed to the real
 * shared `findExactDuplicates()` from contentValidation.js -- no
 * normalization or matching logic is reimplemented here. A duplicate
 * conflict, whether against the database (`existingQuestionsByTestId`) or
 * against an earlier row in the same batch, becomes another entry in
 * `errors`, in the same all-or-nothing shape as a routing/shape error.
 *
 * Error ordering is deterministic: every routing/shape error first (in
 * source-row order, as before), then every duplicate error (in ascending
 * source-row order), merged across all test_id groups by row number --
 * not grouped by test_id.
 *
 * Returns:
 *   { rows: [...normalized rows, ready for buildPayload...], errors: [] }
 *   or
 *   { rows: [], errors: [{ row, reason, ...duplicate fields if applicable }, ...] }
 */
export function validateImportRows(rawRows, validTestIds, existingQuestionsByTestId = {}) {
  const errors = []
  const normalized = []
  const candidates = [] // rows that passed routing+shape: { rowNum, testId, question, normalizedRow }

  rawRows.forEach((row, i) => {
    const rowNum = i + 1
    const { testId, error: testIdError } = resolveImportTestId(row, validTestIds)
    if (testIdError) { errors.push({ row: rowNum, reason: testIdError }); return }

    const shapeError = validateImportRowShape(row)
    if (shapeError) { errors.push({ row: rowNum, reason: shapeError }); return }

    const normalizedRow = normalizeImportRow(row, testId)
    normalized.push(normalizedRow)
    candidates.push({ rowNum, testId, question: row.question, normalizedRow })
  })

  // Group surviving candidates by resolved test_id, preserving each row's
  // original relative order within its group -- findExactDuplicates needs
  // group-local order to determine which repeat is "earlier".
  const groups = new Map() // testId -> candidate[] (original order)
  candidates.forEach(candidate => {
    if (!groups.has(candidate.testId)) groups.set(candidate.testId, [])
    groups.get(candidate.testId).push(candidate)
  })

  const duplicateErrors = []
  for (const [testId, group] of groups) {
    const inputQuestions = group.map(candidate => candidate.question)
    const existingQuestions = getExistingQuestionsForTestId(existingQuestionsByTestId, testId)
    const conflicts = findExactDuplicates(inputQuestions, existingQuestions)

    for (const conflict of conflicts) {
      const candidate = group[conflict.index]
      if (conflict.conflictType === 'existing') {
        duplicateErrors.push({
          row: candidate.rowNum,
          reason: 'Duplicate question already exists in this test.',
          code: 'DUPLICATE_EXISTING',
          testId,
          question: candidate.question,
          matchedId: conflict.matched.id,
          matchedRow: null,
        })
      } else {
        const matchedCandidate = group[conflict.matchedInputIndex]
        duplicateErrors.push({
          row: candidate.rowNum,
          reason: 'Duplicate question appears earlier in this import batch.',
          code: 'DUPLICATE_BATCH',
          testId,
          question: candidate.question,
          matchedId: null,
          matchedRow: matchedCandidate.rowNum,
        })
      }
    }
  }

  // Deterministic final order: routing/shape errors are already in
  // source-row order (built via the single forward forEach above);
  // duplicate errors are merged across test_id groups by ascending row.
  duplicateErrors.sort((a, b) => a.row - b.row)
  const allErrors = [...errors, ...duplicateErrors]

  if (allErrors.length > 0) return { rows: [], errors: allErrors }
  return { rows: normalized, errors: [] }
}
