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
    metadata: f.question_id ? { question_id: f.question_id } : undefined,
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
