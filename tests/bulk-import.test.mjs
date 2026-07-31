// Regression check for src/lib/questionImport.js -- the pure bulk-import
// resolution/validation logic used by src/pages/admin/AdminQuestions.jsx's
// bulkImport().
//
// Unlike the first version of this file, these tests import and exercise
// the REAL production module directly (no copied function bodies) -- see
// Phase 8.1 patch notes for why that changed.
//
// Phase 8.1 regression targets:
//   1. Subject -> test_id resolution fallback (src/config/subjectTestMap.js),
//      lowest priority behind explicit test_id / legacy mock_test_assignment.
//   2. Unknown / blank subject rejected per-row.
//   3. Imported status is ALWAYS forced to lowercase 'draft', regardless of
//      input casing (Draft / DRAFT / draft).
//   4. Imported difficulty is ALWAYS null -- bulk import never preserves or
//      classifies easy/medium/hard, even from a legacy row that supplies one.
//   5. All-or-nothing batch validation: any row error empties the whole
//      `rows` result, even for rows that individually would have passed.
//   6. Phase 8.0 behavior (mock_test_assignment fallback, question_id ->
//      metadata via buildPayload) must remain intact.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveImportTestId,
  validateImportRowShape,
  normalizeImportRow,
  validateImportRows,
} from '../src/lib/questionImport.js'
import { SUBJECT_TEST_MAP } from '../src/config/subjectTestMap.js'

// buildPayload() itself stays inside AdminQuestions.jsx (a React component
// file, not importable standalone without a DOM/component framework -- see
// tests/admin-exams-save.test.mjs for the established reasoning). It is a
// simple, unchanged-by-this-phase object-literal function; its own
// behavior (metadata.question_id, difficulty passthrough for the manual
// Add/Edit form) is covered by mirroring it here exactly as before, but
// the NEW Phase 8.1 logic under test -- resolution, status/difficulty
// normalization, all-or-nothing validation -- is exercised via the real
// imported module above, not a copy.
function buildPayload(f) {
  return {
    test_id: f.test_id?.trim() || null,
    exam_id: f.exam_id || null,
    question: f.question?.trim(),
    option_a: f.option_a, option_b: f.option_b, option_c: f.option_c, option_d: f.option_d,
    correct_answer: f.correct_answer,
    explanation: f.explanation?.trim() || null,
    subject: f.subject?.trim() || null,
    topic: f.topic?.trim() || null,
    subtopic: f.subtopic?.trim() || null,
    difficulty: f.difficulty || null,
    language: f.language || 'en',
    source: f.source?.trim() || null,
    source_year: f.source_year ? Number(f.source_year) : null,
    tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    status: f.status || 'draft',
    metadata: f.question_id ? { question_id: f.question_id } : {},
  }
}
const empty = {
  test_id: '', exam_id: '', question: '',
  option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', explanation: '', subject: '', topic: '', subtopic: '',
  difficulty: 'medium', language: 'en', source: '', source_year: '',
  tags: '', status: 'draft',
}

const VALID_TEST_IDS = new Set([
  'indian-polity', 'indian-economy', 'general-science', 'ap-history',
  'ap-geography', 'current-affairs-apts', 'appsc-gs-1', 'tspsc-gs-1',
])

function baseRow(overrides = {}) {
  return {
    question: 'Sample question?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
    correct_answer: 'A',
    ...overrides,
  }
}

// ── resolveImportTestId ─────────────────────────────────────────────────

test('resolveImportTestId: known subject resolves to its mapped test_id', () => {
  const { testId, error } = resolveImportTestId(baseRow({ subject: 'Indian Polity' }), VALID_TEST_IDS)
  assert.equal(error, undefined)
  assert.equal(testId, 'indian-polity')
})

test('resolveImportTestId: unknown subject returns a clear error listing expected subjects', () => {
  const { testId, error } = resolveImportTestId(baseRow({ subject: 'Indian Politi' }), VALID_TEST_IDS)
  assert.equal(testId, undefined)
  assert.match(error, /unknown subject "Indian Politi"/)
  assert.match(error, /Indian Polity/)
})

test('resolveImportTestId: blank subject (no test_id/mock_test_assignment) returns an error', () => {
  const { error } = resolveImportTestId(baseRow({ subject: '' }), VALID_TEST_IDS)
  assert.match(error, /test_id is required/)
})

test('resolveImportTestId: explicit test_id always wins over subject', () => {
  const { testId, error } = resolveImportTestId(
    baseRow({ subject: 'Indian Polity', test_id: 'appsc-gs-1' }), VALID_TEST_IDS)
  assert.equal(error, undefined)
  assert.equal(testId, 'appsc-gs-1')
})

test('resolveImportTestId: legacy mock_test_assignment resolves when test_id is absent', () => {
  const { testId, error } = resolveImportTestId(
    baseRow({ mock_test_assignment: 'general-science' }), VALID_TEST_IDS)
  assert.equal(error, undefined)
  assert.equal(testId, 'general-science')
})

test('resolveImportTestId: mock_test_assignment outranks subject-derived mapping', () => {
  const { testId } = resolveImportTestId(
    baseRow({ subject: 'Indian Polity', mock_test_assignment: 'appsc-gs-1' }), VALID_TEST_IDS)
  assert.equal(testId, 'appsc-gs-1')
})

test('resolveImportTestId: Current Affairs resolves to its explicit mapped test_id, not a slugified guess', () => {
  const { testId } = resolveImportTestId(baseRow({ subject: 'Current Affairs' }), VALID_TEST_IDS)
  assert.equal(testId, 'current-affairs-apts')
})

test('resolveImportTestId: an unrecognized explicit test_id is still rejected', () => {
  const { error } = resolveImportTestId(baseRow({ test_id: 'not-a-real-test' }), VALID_TEST_IDS)
  assert.match(error, /unknown test_id "not-a-real-test"/)
})

// ── normalizeImportRow ──────────────────────────────────────────────────

test('normalizeImportRow: status is always forced to lowercase "draft" regardless of input casing', () => {
  for (const inputStatus of ['Draft', 'DRAFT', 'draft', undefined]) {
    const row = normalizeImportRow(baseRow({ subject: 'Indian Polity', status: inputStatus }), 'indian-polity')
    assert.equal(row.status, 'draft', `input status "${inputStatus}" must normalize to 'draft'`)
  }
})

test('normalizeImportRow: difficulty is always forced to null, even when a legacy row supplies one', () => {
  for (const inputDifficulty of ['easy', 'medium', 'hard', undefined, null, '']) {
    const row = normalizeImportRow(baseRow({ subject: 'Indian Polity', difficulty: inputDifficulty }), 'indian-polity')
    assert.equal(row.difficulty, null, `input difficulty "${inputDifficulty}" must always become null on import`)
  }
})

// ── validateImportRowShape ───────────────────────────────────────────────

test('validateImportRowShape: missing question or bad correct_answer is rejected', () => {
  assert.match(validateImportRowShape(baseRow({ question: '' })), /missing question or invalid correct_answer/)
  assert.match(validateImportRowShape(baseRow({ correct_answer: 'Z' })), /missing question or invalid correct_answer/)
})

test('validateImportRowShape: missing an option is rejected', () => {
  assert.match(validateImportRowShape(baseRow({ option_c: '' })), /all four options/)
})

test('validateImportRowShape: a valid row passes', () => {
  assert.equal(validateImportRowShape(baseRow()), null)
})

// ── validateImportRows (the whole-batch, all-or-nothing entry point) ───

test('validateImportRows: a fully valid batch returns all rows normalized, zero errors', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity' }),
    baseRow({ subject: 'Current Affairs' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 2)
  assert.equal(out[0].test_id, 'indian-polity')
  assert.equal(out[1].test_id, 'current-affairs-apts')
})

test('validateImportRows: ALL-OR-NOTHING -- one bad row empties the entire batch, even otherwise-valid rows', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity' }),       // would individually pass
    baseRow({ subject: 'Indian Politi' }),       // typo -- fails
    baseRow({ subject: 'Current Affairs' }),     // would individually pass
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(out.length, 0, 'no row should be importable when any row in the batch fails')
  assert.equal(errors.length, 1)
  assert.equal(errors[0].row, 2)
  assert.match(errors[0].reason, /unknown subject "Indian Politi"/)
})

test('validateImportRows: multiple bad rows are all reported, batch still empty', () => {
  const rows = [
    baseRow({ subject: '' }),
    baseRow({ subject: 'Indian Polity' }),
    baseRow({ question: '' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(out.length, 0)
  assert.equal(errors.length, 2)
  assert.deepEqual(errors.map(e => e.row), [1, 3])
})

test('validateImportRows: difficulty and status are normalized on every row of a passing batch', () => {
  const rows = [baseRow({ subject: 'Indian Polity', difficulty: 'hard', status: 'Draft' })]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(errors.length, 0)
  assert.equal(out[0].difficulty, null)
  assert.equal(out[0].status, 'draft')
})

// ── end-to-end through buildPayload(), same shape production code produces ─

test('question_id is preserved into metadata.question_id end to end', () => {
  const rows = [baseRow({ subject: 'Indian Polity', question_id: 'POL-CONS-001-Q01' })]
  const { rows: normalized, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(errors.length, 0)
  const payload = buildPayload({ ...empty, ...normalized[0] })
  assert.deepEqual(payload.metadata, { question_id: 'POL-CONS-001-Q01' })
})

// ── metadata hardening: mock_questions.metadata is NOT NULL (default
// '{}'::jsonb, no DB trigger to fall back on), so buildPayload() must
// never itself produce undefined or null here.
test('buildPayload metadata: without question_id, resolves to {} (never undefined, never null)', () => {
  const payload = buildPayload({ ...empty, question_id: undefined })
  assert.deepEqual(payload.metadata, {})
  assert.notStrictEqual(payload.metadata, undefined)
  assert.notStrictEqual(payload.metadata, null)
})

test('buildPayload metadata: with question_id, resolves to { question_id } (never undefined, never null)', () => {
  const payload = buildPayload({ ...empty, question_id: 'POL-CONS-001-Q01' })
  assert.deepEqual(payload.metadata, { question_id: 'POL-CONS-001-Q01' })
  assert.notStrictEqual(payload.metadata, undefined)
  assert.notStrictEqual(payload.metadata, null)
})

test('a corrected POL-CONS-001-shaped row (subject-routed, lowercase status, no difficulty) imports cleanly end to end', () => {
  const row = {
    question_id: 'POL-CONS-001-Q01',
    subject: 'Indian Polity', topic: 'Constitution',
    question: 'Sample?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
    correct_answer: 'C', explanation: 'Because.',
    status: 'draft', source: 'M. Laxmikanth', source_year: '',
  }
  const { rows: normalized, errors } = validateImportRows([row], VALID_TEST_IDS)
  assert.equal(errors.length, 0)
  const payload = buildPayload({ ...empty, ...normalized[0] })
  assert.equal(payload.test_id, 'indian-polity')
  assert.equal(payload.status, 'draft')
  assert.equal(payload.difficulty, null)
  assert.deepEqual(payload.metadata, { question_id: 'POL-CONS-001-Q01' })
})

test('sanity: SUBJECT_TEST_MAP is the only mapping source used (no local duplicate in this test file)', () => {
  // This test file defines no subject->test_id table of its own; it only
  // ever reads SUBJECT_TEST_MAP re-exported for reference. If this import
  // ever failed to resolve, every test above would already be failing --
  // this just makes the "single source of truth" property explicit.
  assert.ok(Object.keys(SUBJECT_TEST_MAP).length > 0)
  assert.equal(SUBJECT_TEST_MAP['Indian Polity'], 'indian-polity')
})

// ── validateImportRows: Phase 8.3 Step 3, Tier A duplicate detection ────
//
// findExactDuplicates() itself (normalization, matching, conflict typing)
// is already exhaustively covered in tests/content-validation.test.mjs --
// these tests are about the WIRING: grouping by test_id, converting
// group-local indexes back to source-row numbers, the exact duplicate
// error shape, and error ordering. No normalization/matching logic is
// reimplemented here.

test('validateImportRows: default third argument is backward compatible -- a clean batch behaves exactly as before', () => {
  const rows = [baseRow({ subject: 'Indian Polity' })]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 1)
})

test('validateImportRows: a row matching an existing DB question is rejected with the exact DUPLICATE_EXISTING shape', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'existing-q1', test_id: 'indian-polity', question: 'Sample question?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(out.length, 0)
  assert.equal(errors.length, 1)
  assert.deepEqual(errors[0], {
    row: 1,
    reason: 'Duplicate question already exists in this test.',
    code: 'DUPLICATE_EXISTING',
    testId: 'indian-polity',
    question: 'Sample question?',
    matchedId: 'existing-q1',
    matchedRow: null,
  })
})

test('validateImportRows: existingQuestionsByTestId also works as a Map, not just a plain object', () => {
  const existingQuestionsByTestId = new Map([
    ['indian-polity', [{ id: 'existing-q1', test_id: 'indian-polity', question: 'Sample question?' }]],
  ])
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
  assert.equal(errors[0].matchedId, 'existing-q1')
})

test('validateImportRows: two identical new rows in the same batch -- only the later one is rejected, with the exact DUPLICATE_BATCH shape', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Repeated?' }),
    baseRow({ subject: 'Indian Polity', question: 'Repeated?' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(out.length, 0)
  assert.equal(errors.length, 1)
  assert.deepEqual(errors[0], {
    row: 2,
    reason: 'Duplicate question appears earlier in this import batch.',
    code: 'DUPLICATE_BATCH',
    testId: 'indian-polity',
    question: 'Repeated?',
    matchedId: null,
    matchedRow: 1,
  })
})

test('validateImportRows: a row matching both an existing DB question and an earlier batch row reports DUPLICATE_EXISTING for both, never DUPLICATE_BATCH', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'existing-q1', test_id: 'indian-polity', question: 'Shared?' }],
  }
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Shared?' }),
    baseRow({ subject: 'Indian Polity', question: 'Shared?' }),
  ]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(errors.length, 2)
  assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
  assert.equal(errors[1].code, 'DUPLICATE_EXISTING')
})

test('validateImportRows: duplicate checks are scoped per test_id -- the same question text in two different tests is not a conflict', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Cross-test question?' }),
    baseRow({ subject: 'Current Affairs', question: 'Cross-test question?' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 2)
})

test('validateImportRows: routing/shape errors are ordered before duplicate errors, both in ascending source-row order', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Dup?' }),          // row 1 -- first occurrence, clean
    baseRow({ subject: 'Indian Politi', question: 'Typo subject?' }), // row 2 -- routing error
    baseRow({ subject: 'Indian Polity', question: 'Dup?' }),          // row 3 -- batch duplicate of row 1
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(out.length, 0)
  assert.deepEqual(errors.map(e => e.row), [2, 3])
  assert.equal(errors[0].code, undefined, 'a routing error has no code field')
  assert.equal(errors[1].code, 'DUPLICATE_BATCH')
})

test('validateImportRows: duplicate errors from different test_id groups are still merged into one ascending source-row order', () => {
  const existingQuestionsByTestId = {
    'general-science': [{ id: 'e1', test_id: 'general-science', question: 'DB dup?' }],
  }
  const rows = [
    baseRow({ test_id: 'general-science', question: 'DB dup?' }),    // row 1 -- DUPLICATE_EXISTING (general-science group)
    baseRow({ subject: 'Indian Polity', question: 'Batch first?' }), // row 2 -- clean (indian-polity group)
    baseRow({ subject: 'Indian Polity', question: 'Batch first?' }), // row 3 -- DUPLICATE_BATCH (indian-polity group)
  ]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.deepEqual(errors.map(e => e.row), [1, 3])
  assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
  assert.equal(errors[1].code, 'DUPLICATE_BATCH')
})

test('validateImportRows: normalized-text duplicates (case/whitespace) are still caught against the database', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'e1', test_id: 'indian-polity', question: 'What Is It?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: '  what is   it?  ' })]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
})

test('validateImportRows: a duplicate error never includes the complete existing database record, only matchedId', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'e1', test_id: 'indian-polity', question: 'Sample question?', status: 'published' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.deepEqual(
    Object.keys(errors[0]).sort(),
    ['code', 'matchedId', 'matchedRow', 'question', 'reason', 'row', 'testId'].sort()
  )
})

// ── Part 1: prototype-key safety ─────────────────────────────────────────
//
// AdminQuestions.jsx's bulkImport() Pass B builds existingQuestionsByTestId
// with Object.create(null) specifically so a resolved test_id equal to an
// inherited Object.prototype property name ("__proto__", "constructor",
// "toString", etc.) can never collide with that inherited value.
// AdminQuestions.jsx itself is a React component and isn't directly
// unit-testable in this test architecture (same limitation already noted
// at the top of this file for buildPayload()), so these tests instead
// exercise the real exported validateImportRows() ->
// getExistingQuestionsForTestId() path with a lookup object built exactly
// the way the fixed production code builds it, proving the actual code
// that consumes this lookup handles these keys safely end to end -- no
// exception, the correct per-testId bucket is used (not a shared/wrong
// one), and duplicate detection still works correctly for that key.

const RISKY_TEST_IDS = ['__proto__', 'constructor', 'toString']
const VALID_TEST_IDS_WITH_RISKY_KEYS = new Set([...VALID_TEST_IDS, ...RISKY_TEST_IDS])

for (const riskyTestId of RISKY_TEST_IDS) {
  test(`validateImportRows: a resolved test_id of "${riskyTestId}" does not throw and correctly detects a duplicate (Object.create(null) lookup, matching production)`, () => {
    const existingQuestionsByTestId = Object.create(null)
    existingQuestionsByTestId[riskyTestId] = [{ id: 'e1', test_id: riskyTestId, question: 'Sample question?' }]

    const rows = [baseRow({ test_id: riskyTestId, question: 'Sample question?' })]
    assert.doesNotThrow(() => validateImportRows(rows, VALID_TEST_IDS_WITH_RISKY_KEYS, existingQuestionsByTestId))

    const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS_WITH_RISKY_KEYS, existingQuestionsByTestId)
    assert.equal(out.length, 0)
    assert.equal(errors.length, 1)
    assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
    assert.equal(errors[0].testId, riskyTestId)
    assert.equal(errors[0].matchedId, 'e1')
  })

  test(`validateImportRows: a resolved test_id of "${riskyTestId}" -- a non-duplicate row still imports cleanly (proves the correct bucket is used, not a wrong/shared one)`, () => {
    const existingQuestionsByTestId = Object.create(null)
    existingQuestionsByTestId[riskyTestId] = [{ id: 'e1', test_id: riskyTestId, question: 'Unrelated existing question?' }]

    const rows = [baseRow({ test_id: riskyTestId, question: 'A brand new question?' })]
    const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS_WITH_RISKY_KEYS, existingQuestionsByTestId)
    assert.equal(errors.length, 0)
    assert.equal(out.length, 1)
  })
}

test('validateImportRows: getExistingQuestionsForTestId is safe even with a PLAIN {} (not Object.create(null)) lookup and a "constructor" test_id -- the shared function is defensive regardless of caller construction', () => {
  const existingQuestionsByTestId = {} // deliberately NOT null-prototype
  const validTestIdsWithConstructor = new Set([...VALID_TEST_IDS, 'constructor'])
  const rows = [baseRow({ test_id: 'constructor', question: 'Some question?' })]
  assert.doesNotThrow(() => validateImportRows(rows, validTestIdsWithConstructor, existingQuestionsByTestId))
  const { rows: out, errors } = validateImportRows(rows, validTestIdsWithConstructor, existingQuestionsByTestId)
  assert.equal(errors.length, 0, 'no real existing data was supplied for "constructor" -- it must import cleanly, not crash or false-positive')
  assert.equal(out.length, 1)
})

// ── Part 2: completing previously MISSING/PARTIAL checklist items ───────

test('validateImportRows: an existing CASE-ONLY duplicate rejects the full import, rows is []', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'e1', test_id: 'indian-polity', question: 'What is the capital?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'WHAT IS THE CAPITAL?' })]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.deepEqual(out, [])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
})

test('validateImportRows: an existing WHITESPACE-ONLY normalized duplicate rejects the full import, rows is []', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'e1', test_id: 'indian-polity', question: 'What is the capital?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: '  What   is the   capital?  ' })]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.deepEqual(out, [])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].code, 'DUPLICATE_EXISTING')
})

test('validateImportRows: a punctuation-only difference from an existing question is allowed, not treated as a duplicate', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'e1', test_id: 'indian-polity', question: 'What is the capital?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'What is the capital' })] // no trailing '?'
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 1)
})

test('validateImportRows: the same question text already existing in a DIFFERENT test_id is allowed', () => {
  const existingQuestionsByTestId = {
    'general-science': [{ id: 'e1', test_id: 'general-science', question: 'Shared text?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Shared text?' })]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 1)
})

test('validateImportRows: a case/whitespace-only duplicate WITHIN the batch rejects the full import', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'What is the capital?' }),
    baseRow({ subject: 'Indian Polity', question: '  WHAT IS THE   CAPITAL?  ' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.deepEqual(out, [])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].code, 'DUPLICATE_BATCH')
  assert.equal(errors[0].row, 2)
  assert.equal(errors[0].matchedRow, 1)
})

test('validateImportRows: three repeated rows in a batch report the second and third as conflicts, in source-row order, both referencing the first', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }),
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }),
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.deepEqual(out, [])
  assert.equal(errors.length, 2)
  assert.deepEqual(errors.map(e => e.row), [2, 3])
  assert.deepEqual(errors.map(e => e.matchedRow), [1, 1])
  assert.deepEqual(errors.map(e => e.code), ['DUPLICATE_BATCH', 'DUPLICATE_BATCH'])
})

test('validateImportRows: an empty/malformed question stays a required-field error, never miscategorized as a duplicate, even alongside real duplicates elsewhere in the batch', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: '' }),        // row 1 -- shape error
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }), // row 2 -- clean (first occurrence)
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }), // row 3 -- batch duplicate of row 2
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.deepEqual(out, [])
  assert.equal(errors.length, 2)
  assert.equal(errors[0].row, 1)
  assert.match(errors[0].reason, /missing question or invalid correct_answer/)
  assert.equal(errors[0].code, undefined, 'a shape error must never carry a duplicate code')
  assert.equal(errors[1].row, 3)
  assert.equal(errors[1].code, 'DUPLICATE_BATCH')
})

test('validateImportRows: a resolved test_id absent from existingQuestionsByTestId behaves as no existing data (missing key => [])', () => {
  const existingQuestionsByTestId = {
    'general-science': [{ id: 'e1', test_id: 'general-science', question: 'Unrelated?' }],
  }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })] // 'indian-polity' key absent
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 1)
})

test('validateImportRows: every kind of invalid existing-questions value (string, object, number, null, undefined) is treated as empty, never thrown', () => {
  for (const invalidValue of ['not-an-array', {}, 42, null, undefined]) {
    const existingQuestionsByTestId = { 'indian-polity': invalidValue }
    const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
    assert.doesNotThrow(() => validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId))
    const { errors } = validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
    assert.equal(errors.length, 0, `invalid value ${JSON.stringify(invalidValue)} must not produce a false duplicate or throw`)
  }
})

test('validateImportRows: a null third argument behaves as no existing data', () => {
  const rows = [baseRow({ subject: 'Indian Polity' })]
  assert.doesNotThrow(() => validateImportRows(rows, VALID_TEST_IDS, null))
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, null)
  assert.equal(errors.length, 0)
})

test('validateImportRows: an explicit undefined third argument behaves as no existing data (falls through to the default)', () => {
  const rows = [baseRow({ subject: 'Indian Polity' })]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS, undefined)
  assert.equal(errors.length, 0)
})

test('validateImportRows: a caller-supplied plain object lookup is never mutated', () => {
  const existingQuestionsByTestId = {
    'indian-polity': [{ id: 'e1', test_id: 'indian-polity', question: 'Sample question?' }],
  }
  const before = JSON.parse(JSON.stringify(existingQuestionsByTestId))
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.deepEqual(existingQuestionsByTestId, before)
})

test('validateImportRows: a caller-supplied Map lookup is never mutated', () => {
  const record = { id: 'e1', test_id: 'indian-polity', question: 'Sample question?' }
  const existingQuestionsByTestId = new Map([['indian-polity', [record]]])
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.equal(existingQuestionsByTestId.size, 1)
  assert.deepEqual(existingQuestionsByTestId.get('indian-polity'), [record])
})

test('validateImportRows: caller-supplied rawRows array and individual row objects are never mutated', () => {
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  const rowsBefore = JSON.parse(JSON.stringify(rows))
  validateImportRows(rows, VALID_TEST_IDS)
  assert.deepEqual(rows, rowsBefore)
})

test('validateImportRows: existing-question record objects inside the lookup are never mutated', () => {
  const record = { id: 'e1', test_id: 'indian-polity', question: 'Sample question?' }
  const recordBefore = JSON.parse(JSON.stringify(record))
  const existingQuestionsByTestId = { 'indian-polity': [record] }
  const rows = [baseRow({ subject: 'Indian Polity', question: 'Sample question?' })]
  validateImportRows(rows, VALID_TEST_IDS, existingQuestionsByTestId)
  assert.deepEqual(record, recordBefore)
})

test('validateImportRows: a mixed batch of clean rows plus one conflicting row returns rows: [] (all-or-nothing, not just dropping the conflicting one)', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Clean one?' }),
    baseRow({ subject: 'Indian Polity', question: 'Clean two?' }),
    baseRow({ subject: 'Indian Polity', question: 'Clean one?' }), // duplicate of row 1
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.deepEqual(out, [])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].row, 3)
})

test('validateImportRows: a DUPLICATE_BATCH error object contains exactly the seven approved fields, no more, no fewer', () => {
  const rows = [
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }),
    baseRow({ subject: 'Indian Polity', question: 'Repeat?' }),
  ]
  const { errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.deepEqual(
    Object.keys(errors[0]).sort(),
    ['row', 'reason', 'code', 'testId', 'question', 'matchedId', 'matchedRow'].sort()
  )
})

// ── Phase 9: Indian Geography destination routing ──────────────────────
//
// VALID_TEST_IDS (above) intentionally does NOT include 'indian-geography'
// -- it mirrors AdminQuestions.jsx's live `tests` state, sourced from
// public.mock_tests, and that catalog row does not exist until the Phase 9
// migration is applied. These tests prove both halves of resolution:
// SUBJECT_TEST_MAP now maps the subject, but resolveImportTestId/
// validateImportRows still correctly reject it until validTestIds also
// contains it -- and correctly accept it once both are true. A second,
// local set (VALID_TEST_IDS_WITH_INDIAN_GEOGRAPHY) is used only where the
// catalog row is meant to already exist, so the shared VALID_TEST_IDS
// fixture -- and every test above that depends on it -- is left untouched.

const VALID_TEST_IDS_WITH_INDIAN_GEOGRAPHY = new Set([...VALID_TEST_IDS, 'indian-geography'])

test('resolveImportTestId: Indian Geography subject resolves to indian-geography through the subject fallback', () => {
  const { testId, error } = resolveImportTestId(
    baseRow({ subject: 'Indian Geography' }), VALID_TEST_IDS_WITH_INDIAN_GEOGRAPHY)
  assert.equal(error, undefined)
  assert.equal(testId, 'indian-geography')
})

test('resolveImportTestId: mock_test_assignment = indian-geography resolves directly, bypassing the subject map entirely', () => {
  const { testId, error } = resolveImportTestId(
    baseRow({ mock_test_assignment: 'indian-geography' }), VALID_TEST_IDS_WITH_INDIAN_GEOGRAPHY)
  assert.equal(error, undefined)
  assert.equal(testId, 'indian-geography')
})

test('resolveImportTestId: Indian Geography subject is rejected while indian-geography is absent from validTestIds', () => {
  const { testId, error } = resolveImportTestId(baseRow({ subject: 'Indian Geography' }), VALID_TEST_IDS)
  assert.equal(testId, undefined)
  assert.match(error, /unknown test_id "indian-geography"/)
})

test('resolveImportTestId: mock_test_assignment = indian-geography is also rejected while absent from validTestIds', () => {
  const { testId, error } = resolveImportTestId(
    baseRow({ mock_test_assignment: 'indian-geography' }), VALID_TEST_IDS)
  assert.equal(testId, undefined)
  assert.match(error, /unknown test_id "indian-geography"/)
})

test('validateImportRows: an Indian Geography batch is rejected whole (all-or-nothing) while its catalog row is absent', () => {
  const rows = [
    baseRow({ subject: 'Indian Geography', question: 'Which river forms the Kaveri delta?' }),
    baseRow({ subject: 'Indian Polity', question: 'Would individually pass?' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS)
  assert.equal(out.length, 0, 'the whole batch must be rejected, including the otherwise-valid Indian Polity row')
  assert.equal(errors.length, 1)
  assert.equal(errors[0].row, 1)
  assert.match(errors[0].reason, /unknown test_id "indian-geography"/)
})

test('validateImportRows: an Indian Geography batch passes validation once its catalog row exists', () => {
  const rows = [
    baseRow({ subject: 'Indian Geography', question: 'Which river forms the Kaveri delta?' }),
  ]
  const { rows: out, errors } = validateImportRows(rows, VALID_TEST_IDS_WITH_INDIAN_GEOGRAPHY)
  assert.equal(errors.length, 0)
  assert.equal(out.length, 1)
  assert.equal(out[0].test_id, 'indian-geography')
})

test('normalizeImportRow: no input status lets an Indian Geography row bypass normalization to draft', () => {
  for (const inputStatus of ['published', 'Published', 'PUBLISHED', 'approved', undefined]) {
    const row = normalizeImportRow(baseRow({ subject: 'Indian Geography', status: inputStatus }), 'indian-geography')
    assert.equal(row.status, 'draft', `input status "${inputStatus}" must normalize to 'draft' for Indian Geography too`)
  }
})

test('SUBJECT_TEST_MAP: Indian Geography entry is present and no existing mapping was altered', () => {
  assert.equal(SUBJECT_TEST_MAP['Indian Geography'], 'indian-geography')
  assert.equal(SUBJECT_TEST_MAP['Indian Polity'], 'indian-polity')
  assert.equal(SUBJECT_TEST_MAP['Indian Economy'], 'indian-economy')
  assert.equal(SUBJECT_TEST_MAP['General Science'], 'general-science')
  assert.equal(SUBJECT_TEST_MAP['AP History'], 'ap-history')
  assert.equal(SUBJECT_TEST_MAP['AP Geography'], 'ap-geography')
  assert.equal(SUBJECT_TEST_MAP['Current Affairs'], 'current-affairs-apts')
  assert.equal(Object.keys(SUBJECT_TEST_MAP).length, 7)
})
