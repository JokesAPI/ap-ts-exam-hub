// Regression check for src/lib/contentValidation.js -- the pure
// duplicate-detection logic shared by Manual Create, Manual Edit, Bulk
// Import, and Publish in src/pages/admin/AdminQuestions.jsx.
//
// Same convention as tests/bulk-import.test.mjs: these tests import and
// exercise the REAL production module directly, no copied function bodies.
//
// Phase 8.3 regression targets:
//   1. normalizeQuestionText: whitespace collapse, case-fold, null/undefined
//      safety, punctuation and numbers left untouched.
//   2. findExactDuplicate (Tier A, single): exact/case/whitespace matches,
//      punctuation differences are NOT treated as a match, excludeId guards
//      Manual Edit's self-match case, inputs are never mutated.
//   2b. (code-review Fix 1) empty/whitespace-only normalized values never
//      match, on either side of the comparison -- an empty input never
//      matches an empty existing row, and a malformed existing row with a
//      null/undefined/empty question is skipped rather than compared.
//   3. findExactDuplicates (Tier A, batch): conflicts against existing DB
//      rows, clean rows excluded from the result, deterministic index
//      ordering.
//   3b. (code-review Fix 2) findExactDuplicates also detects duplicates
//      WITHIN the same input batch (conflictType: 'batch'), distinct from
//      conflicts against existing DB rows (conflictType: 'existing'). The
//      first occurrence of a repeated question is never itself flagged;
//      every later repeat is, and always references that first occurrence.
//   4. formatNearDuplicateWarnings (Tier B formatter): normal RPC rows,
//      empty/null/undefined input, numeric similarity preserved, no
//      blocking field ever introduced.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeQuestionText,
  findExactDuplicate,
  findExactDuplicates,
  formatNearDuplicateWarnings,
} from '../src/lib/contentValidation.js'

function existing(overrides = {}) {
  return { id: 'existing-1', question: 'What is the capital of Andhra Pradesh?', ...overrides }
}

// ── normalizeQuestionText ────────────────────────────────────────────────

test('normalizeQuestionText: exact text is returned unchanged (already normalized)', () => {
  assert.equal(normalizeQuestionText('what is the capital of andhra pradesh?'), 'what is the capital of andhra pradesh?')
})

test('normalizeQuestionText: uppercase and lowercase normalize to the same value', () => {
  const a = normalizeQuestionText('What Is The Capital?')
  const b = normalizeQuestionText('WHAT IS THE CAPITAL?')
  assert.equal(a, b)
  assert.equal(a, 'what is the capital?')
})

test('normalizeQuestionText: leading and trailing whitespace is trimmed', () => {
  assert.equal(normalizeQuestionText('   What is it?   '), 'what is it?')
})

test('normalizeQuestionText: tabs, newlines, and multiple spaces all collapse to one space', () => {
  assert.equal(normalizeQuestionText('What\tis\n\nit    now?'), 'what is it now?')
})

test('normalizeQuestionText: punctuation is preserved, not stripped', () => {
  assert.equal(normalizeQuestionText("What's the capital, exactly?!"), "what's the capital, exactly?!")
})

test('normalizeQuestionText: numbers are preserved, not altered', () => {
  assert.equal(normalizeQuestionText('In what year was 1947 significant?'), 'in what year was 1947 significant?')
})

test('normalizeQuestionText: null and undefined safely become an empty string', () => {
  assert.equal(normalizeQuestionText(null), '')
  assert.equal(normalizeQuestionText(undefined), '')
})

// ── findExactDuplicate (Tier A, single) ─────────────────────────────────

test('findExactDuplicate: exact match is found', () => {
  const match = findExactDuplicate('What is the capital of Andhra Pradesh?', [existing()])
  assert.equal(match.id, 'existing-1')
})

test('findExactDuplicate: case-only difference is still a match', () => {
  const match = findExactDuplicate('WHAT IS THE CAPITAL OF ANDHRA PRADESH?', [existing()])
  assert.equal(match.id, 'existing-1')
})

test('findExactDuplicate: whitespace-only difference is still a match', () => {
  const match = findExactDuplicate('  What is   the capital of Andhra   Pradesh?  ', [existing()])
  assert.equal(match.id, 'existing-1')
})

test('findExactDuplicate: a punctuation difference is NOT an exact match', () => {
  const match = findExactDuplicate('What is the capital of Andhra Pradesh', [existing()]) // no trailing '?'
  assert.equal(match, null)
})

test('findExactDuplicate: no match returns null', () => {
  const match = findExactDuplicate('What is the capital of Telangana?', [existing()])
  assert.equal(match, null)
})

test('findExactDuplicate: excludeId prevents a record from matching itself', () => {
  const match = findExactDuplicate('What is the capital of Andhra Pradesh?', [existing()], { excludeId: 'existing-1' })
  assert.equal(match, null)
})

test('findExactDuplicate: excludeId only skips the named record, others still match', () => {
  const records = [existing({ id: 'existing-1' }), existing({ id: 'existing-2' })]
  const match = findExactDuplicate('What is the capital of Andhra Pradesh?', records, { excludeId: 'existing-1' })
  assert.equal(match.id, 'existing-2')
})

test('findExactDuplicate: inputs are never mutated', () => {
  const records = [existing()]
  const recordsCopy = JSON.parse(JSON.stringify(records))
  const inputQuestion = 'What is the capital of Andhra Pradesh?'
  findExactDuplicate(inputQuestion, records, { excludeId: 'someone-else' })
  assert.deepEqual(records, recordsCopy)
  assert.equal(inputQuestion, 'What is the capital of Andhra Pradesh?')
})

// ── findExactDuplicate: Fix 1, empty normalized values never match ──────

test('findExactDuplicate (Fix 1): empty input does not match an empty existing question', () => {
  const match = findExactDuplicate('', [existing({ question: '' })])
  assert.equal(match, null)
})

test('findExactDuplicate (Fix 1): whitespace-only input does not match an empty existing question', () => {
  const match = findExactDuplicate('   \t\n  ', [existing({ question: '' })])
  assert.equal(match, null)
})

test('findExactDuplicate (Fix 1): null input does not match an existing undefined question', () => {
  const match = findExactDuplicate(null, [existing({ question: undefined })])
  assert.equal(match, null)
})

test('findExactDuplicate (Fix 1): a valid input ignores malformed existing rows with null/undefined/empty questions', () => {
  const malformed = [
    existing({ id: 'bad-null', question: null }),
    existing({ id: 'bad-undefined', question: undefined }),
    existing({ id: 'bad-empty', question: '' }),
    existing({ id: 'bad-whitespace', question: '   ' }),
  ]
  const match = findExactDuplicate('What is the capital of Andhra Pradesh?', malformed)
  assert.equal(match, null, 'a real question must never match any of these malformed rows')
})

test('findExactDuplicate (Fix 1): a later valid existing record can still match after malformed records are skipped', () => {
  const records = [
    existing({ id: 'bad-null', question: null }),
    existing({ id: 'bad-empty', question: '' }),
    existing({ id: 'good', question: 'What is the capital of Andhra Pradesh?' }),
  ]
  const match = findExactDuplicate('What is the capital of Andhra Pradesh?', records)
  assert.equal(match.id, 'good')
})

// ── findExactDuplicates (Tier A, batch) ─────────────────────────────────

test('findExactDuplicates: multiple independent existing-DB conflicts are all reported', () => {
  const records = [existing({ id: 'e1', question: 'Question one?' }), existing({ id: 'e2', question: 'Question two?' })]
  const inputs = ['Question one?', 'Question two?', 'Question three?']
  const conflicts = findExactDuplicates(inputs, records)
  assert.equal(conflicts.length, 2)
  assert.equal(conflicts[0].conflictType, 'existing')
  assert.equal(conflicts[0].matched.id, 'e1')
  assert.equal(conflicts[1].conflictType, 'existing')
  assert.equal(conflicts[1].matched.id, 'e2')
})

test('findExactDuplicates: clean inputs with no match are excluded from the result', () => {
  const records = [existing({ id: 'e1', question: 'Question one?' })]
  const inputs = ['Question one?', 'A totally different question?']
  const conflicts = findExactDuplicates(inputs, records)
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].inputQuestion, 'Question one?')
})

test('findExactDuplicates: two separate input rows matching the same existing record both get their own "existing" entry', () => {
  const records = [existing({ id: 'e1', question: 'Repeated question?' })]
  const inputs = ['Repeated question?', 'Repeated question?']
  const conflicts = findExactDuplicates(inputs, records)
  assert.equal(conflicts.length, 2, 'both rows must be reported, not deduplicated into one')
  assert.equal(conflicts[0].conflictType, 'existing')
  assert.equal(conflicts[0].matched.id, 'e1')
  assert.equal(conflicts[1].conflictType, 'existing')
  assert.equal(conflicts[1].matched.id, 'e1')
})

test('findExactDuplicates: results are ordered deterministically by input index', () => {
  const records = [existing({ id: 'e1', question: 'A?' }), existing({ id: 'e2', question: 'C?' })]
  const inputs = ['A?', 'B?', 'C?']
  const conflicts = findExactDuplicates(inputs, records)
  assert.deepEqual(conflicts.map(c => c.index), [0, 2])
})

// ── findExactDuplicates: Fix 2, duplicates within the same batch ────────

test('findExactDuplicates (Fix 2): a new question matching an EARLIER row in the same batch is flagged conflictType "batch"', () => {
  const conflicts = findExactDuplicates(['New row A?', 'New row A?'], [])
  assert.equal(conflicts.length, 1, 'the first occurrence is never itself flagged')
  assert.equal(conflicts[0].index, 1)
  assert.equal(conflicts[0].conflictType, 'batch')
  assert.equal(conflicts[0].matched, null)
  assert.equal(conflicts[0].matchedInputIndex, 0)
  assert.equal(conflicts[0].matchedInputQuestion, 'New row A?')
})

test('findExactDuplicates (Fix 2): a batch conflict is normalization-aware, same as Tier A single-record comparison', () => {
  const conflicts = findExactDuplicates(['New row A?', '  NEW ROW A?  '], [])
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'batch')
  assert.equal(conflicts[0].matchedInputIndex, 0)
})

test('findExactDuplicates (Fix 2): three repeats of the same new row all reference the FIRST occurrence, not the immediately preceding one', () => {
  const conflicts = findExactDuplicates(['Repeat?', 'Repeat?', 'Repeat?'], [])
  assert.equal(conflicts.length, 2)
  assert.equal(conflicts[0].index, 1)
  assert.equal(conflicts[0].matchedInputIndex, 0)
  assert.equal(conflicts[1].index, 2)
  assert.equal(conflicts[1].matchedInputIndex, 0, 'must reference the first occurrence, not index 1')
})

test('findExactDuplicates (Fix 2): an existing-DB conflict takes priority over a batch conflict on the same row', () => {
  const records = [existing({ id: 'e1', question: 'Shared text?' })]
  // Both rows exactly match an existing DB record AND each other -- 'existing' wins for both.
  const conflicts = findExactDuplicates(['Shared text?', 'Shared text?'], records)
  assert.equal(conflicts.length, 2)
  assert.equal(conflicts[0].conflictType, 'existing')
  assert.equal(conflicts[1].conflictType, 'existing')
})

test('findExactDuplicates (Fix 2): existing-DB and batch conflicts can both appear in one result, correctly typed per row', () => {
  const records = [existing({ id: 'e1', question: 'DB question?' })]
  const inputs = ['DB question?', 'Fresh question?', 'Fresh question?']
  const conflicts = findExactDuplicates(inputs, records)
  assert.equal(conflicts.length, 2)
  assert.deepEqual(conflicts.map(c => c.index), [0, 2])
  assert.equal(conflicts[0].conflictType, 'existing')
  assert.equal(conflicts[1].conflictType, 'batch')
  assert.equal(conflicts[1].matchedInputIndex, 1)
})

test('findExactDuplicates (Fix 2): empty/whitespace-only rows are skipped entirely, never flagged and never a "first occurrence"', () => {
  const conflicts = findExactDuplicates(['', '   ', 'Real question?'], [])
  assert.equal(conflicts.length, 0)
})

// ── findExactDuplicates: return-contract shape for both conflict types ──

const CONFLICT_KEYS = ['conflictType', 'index', 'inputQuestion', 'matched', 'matchedInputIndex', 'matchedInputQuestion'].sort()

test('findExactDuplicates: an "existing" conflict has exactly the six documented keys, no more, no fewer', () => {
  const records = [existing({ id: 'e1', question: 'DB question?' })]
  const [conflict] = findExactDuplicates(['DB question?'], records)
  assert.deepEqual(Object.keys(conflict).sort(), CONFLICT_KEYS)
})

test('findExactDuplicates: an "existing" conflict has the documented values for every field', () => {
  const record = existing({ id: 'e1', question: 'DB question?' })
  const [conflict] = findExactDuplicates(['DB question?'], [record])
  assert.equal(conflict.conflictType, 'existing')
  assert.equal(conflict.matched, record)
  assert.equal(conflict.matchedInputIndex, null)
  assert.equal(conflict.matchedInputQuestion, null)
})

test('findExactDuplicates: a "batch" conflict has exactly the six documented keys, no more, no fewer', () => {
  const [conflict] = findExactDuplicates(['Repeat?', 'Repeat?'], [])
  assert.deepEqual(Object.keys(conflict).sort(), CONFLICT_KEYS)
})

test('findExactDuplicates: a "batch" conflict has the documented values for every field', () => {
  const [conflict] = findExactDuplicates(['Repeat?', 'Repeat?'], [])
  assert.equal(conflict.conflictType, 'batch')
  assert.equal(conflict.matched, null)
  assert.equal(conflict.matchedInputIndex, 0)
  assert.equal(conflict.matchedInputQuestion, 'Repeat?')
})

// ── formatNearDuplicateWarnings (Tier B formatter) ──────────────────────

test('formatNearDuplicateWarnings: normal RPC rows are reshaped to camelCase', () => {
  const rpcRows = [{
    input_question: 'What is the capital?',
    matched_id: 'q-123',
    matched_question: 'What is the capital city?',
    matched_status: 'published',
    similarity: 0.62,
  }]
  const warnings = formatNearDuplicateWarnings(rpcRows)
  assert.equal(warnings.length, 1)
  assert.deepEqual(warnings[0], {
    inputQuestion: 'What is the capital?',
    matchedId: 'q-123',
    matchedQuestion: 'What is the capital city?',
    matchedStatus: 'published',
    similarity: 0.62,
  })
})

test('formatNearDuplicateWarnings: an empty array stays an empty array', () => {
  assert.deepEqual(formatNearDuplicateWarnings([]), [])
})

test('formatNearDuplicateWarnings: null or undefined input becomes an empty array', () => {
  assert.deepEqual(formatNearDuplicateWarnings(null), [])
  assert.deepEqual(formatNearDuplicateWarnings(undefined), [])
})

test('formatNearDuplicateWarnings: non-array input becomes an empty array', () => {
  assert.deepEqual(formatNearDuplicateWarnings('not an array'), [])
  assert.deepEqual(formatNearDuplicateWarnings({}), [])
})

test('formatNearDuplicateWarnings: similarity is preserved as a number, not a string', () => {
  const warnings = formatNearDuplicateWarnings([{
    input_question: 'X', matched_id: 'y', matched_question: 'X near', matched_status: 'draft', similarity: '0.5',
  }])
  assert.equal(typeof warnings[0].similarity, 'number')
  assert.equal(warnings[0].similarity, 0.5)
})

// ── formatNearDuplicateWarnings: Fix 3, invalid similarity rows are dropped ─

function rpcRow(similarity) {
  return { input_question: 'X', matched_id: 'y', matched_question: 'X near', matched_status: 'draft', similarity }
}

test('formatNearDuplicateWarnings (Fix 3): a valid numeric string is converted to a number', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow('0.73')])
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].similarity, 0.73)
  assert.equal(typeof warnings[0].similarity, 'number')
})

test('formatNearDuplicateWarnings (Fix 3): a row with null similarity is dropped, NOT converted to 0', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow(null)])
  assert.equal(warnings.length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): a row with undefined similarity is dropped', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow(undefined)])
  assert.equal(warnings.length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): a row with an empty-string similarity is dropped', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow('')])
  assert.equal(warnings.length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): a row with a whitespace-only similarity string is dropped', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow('   \t  ')])
  assert.equal(warnings.length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): a row with a non-numeric similarity string is dropped', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow('not-a-number')])
  assert.equal(warnings.length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): a row with numeric NaN similarity is dropped', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow(NaN)])
  assert.equal(warnings.length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): rows with Infinity or -Infinity similarity are dropped', () => {
  assert.equal(formatNearDuplicateWarnings([rpcRow(Infinity)]).length, 0)
  assert.equal(formatNearDuplicateWarnings([rpcRow(-Infinity)]).length, 0)
})

test('formatNearDuplicateWarnings (Fix 3): no warning ever contains NaN as its similarity', () => {
  const warnings = formatNearDuplicateWarnings([
    rpcRow(null), rpcRow(undefined), rpcRow(''), rpcRow('   '), rpcRow('nonsense'),
    rpcRow(NaN), rpcRow(Infinity), rpcRow(-Infinity), rpcRow(0.5), rpcRow('0.5'),
  ])
  for (const w of warnings) assert.ok(!Number.isNaN(w.similarity))
})

test('formatNearDuplicateWarnings (Fix 3): valid and invalid rows in the same batch -- only the valid ones survive, in order', () => {
  const rpcRows = [rpcRow(0.9), rpcRow(null), rpcRow('0.4'), rpcRow('garbage'), rpcRow(Infinity)]
  const warnings = formatNearDuplicateWarnings(rpcRows)
  assert.equal(warnings.length, 2)
  assert.deepEqual(warnings.map(w => w.similarity), [0.9, 0.4])
})

test('formatNearDuplicateWarnings (Fix 3): a numeric zero similarity is valid and kept (0 is finite, not "missing")', () => {
  const warnings = formatNearDuplicateWarnings([rpcRow(0)])
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].similarity, 0)
})

test('formatNearDuplicateWarnings (Fix 3): the original array and row objects are never mutated', () => {
  const rpcRows = [rpcRow(0.5), rpcRow(null)]
  const originalCopy = JSON.parse(JSON.stringify(rpcRows, (k, v) => (Number.isNaN(v) ? 'NaN' : v)))
  formatNearDuplicateWarnings(rpcRows)
  assert.deepEqual(rpcRows, originalCopy)
})

test('formatNearDuplicateWarnings: no blocking field is ever introduced', () => {
  const warnings = formatNearDuplicateWarnings([{
    input_question: 'X', matched_id: 'y', matched_question: 'X near', matched_status: 'draft', similarity: 0.9,
  }])
  assert.deepEqual(Object.keys(warnings[0]).sort(), ['inputQuestion', 'matchedId', 'matchedQuestion', 'matchedStatus', 'similarity'].sort())
})
