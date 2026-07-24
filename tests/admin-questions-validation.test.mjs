// Phase 8.3 Step 4 -- tests for the pure decision helper backing Manual
// Create/Edit duplicate validation in AdminQuestions.jsx's save().
//
// save() itself is a React closure over component state and can't be
// exercised without a browser/React test framework -- see the code-path
// audit in the accompanying report for that half of the verification.
// These tests import and exercise the REAL evaluateQuestionSaveDuplicates
// export, which itself reuses the real findExactDuplicate and
// formatNearDuplicateWarnings from contentValidation.js -- no
// normalization, comparison, or RPC-formatting logic is reimplemented
// here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateQuestionSaveDuplicates } from '../src/lib/adminQuestionValidation.js'

function existing(overrides = {}) {
  return { id: 'existing-1', test_id: 'indian-polity', question: 'What is the capital of Andhra Pradesh?', ...overrides }
}

function rpcRow(overrides = {}) {
  return {
    input_question: 'What is the capital?',
    matched_id: 'e1',
    matched_question: 'What is the capital city?',
    matched_status: 'published',
    similarity: 0.6,
    ...overrides,
  }
}

// ── Tier A ────────────────────────────────────────────────────────────

test('evaluateQuestionSaveDuplicates: an exact create duplicate is returned as tierAConflict', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: undefined,
    existingQuestions: [existing()],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict.id, 'existing-1')
})

test('evaluateQuestionSaveDuplicates: a case-only duplicate is returned as tierAConflict', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'WHAT IS THE CAPITAL OF ANDHRA PRADESH?',
    editingId: undefined,
    existingQuestions: [existing()],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict.id, 'existing-1')
})

test('evaluateQuestionSaveDuplicates: a whitespace-only duplicate is returned as tierAConflict', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: '  What is   the capital of Andhra   Pradesh?  ',
    editingId: undefined,
    existingQuestions: [existing()],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict.id, 'existing-1')
})

test('evaluateQuestionSaveDuplicates: a punctuation difference is not a Tier A conflict', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh', // no trailing '?'
    editingId: undefined,
    existingQuestions: [existing()],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict, null)
})

test('evaluateQuestionSaveDuplicates: same text is not flagged when the caller only supplies records from another test scope', () => {
  // The helper never filters by test_id itself -- it trusts whatever the
  // caller passes as existingQuestions. This proves that contract: giving
  // it records that don't include a matching question (as if the caller
  // had already scoped the fetch to a different test_id) means no conflict.
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: undefined,
    existingQuestions: [existing({ id: 'other-test-record', test_id: 'general-science', question: 'Unrelated question?' })],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict, null)
})

test('evaluateQuestionSaveDuplicates: editingId excludes a self-match', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: 'existing-1',
    existingQuestions: [existing({ id: 'existing-1' })],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict, null)
})

test('evaluateQuestionSaveDuplicates: editingId still allows another exact matching record to be returned', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: 'being-edited',
    existingQuestions: [
      existing({ id: 'being-edited', question: 'Some other question being edited' }),
      existing({ id: 'a-different-record' }),
    ],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict.id, 'a-different-record')
})

test('evaluateQuestionSaveDuplicates: Tier A takes priority -- a Tier A conflict is reported even when Tier B rows are also supplied', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: undefined,
    existingQuestions: [existing()],
    nearDuplicateRpcRows: [rpcRow()],
  })
  assert.ok(result.tierAConflict, 'Tier A conflict must still be reported')
  // The helper itself doesn't decide ordering of caller actions (that's
  // save()'s job, verified separately in the code-path audit) -- but it
  // must never hide a real Tier A conflict just because Tier B rows exist.
})

// ── Fix 1: existingQuestions is safely normalized before findExactDuplicate ──

test('evaluateQuestionSaveDuplicates (Fix 1): a valid existingQuestions array still detects exact duplicates', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: undefined,
    existingQuestions: [existing()],
    nearDuplicateRpcRows: [],
  })
  assert.equal(result.tierAConflict.id, 'existing-1')
})

for (const [label, invalidValue] of [
  ['null', null],
  ['undefined', undefined],
  ['a plain object', {}],
  ['a number', 42],
  ['a string', 'not-an-array'],
  ['a boolean', true],
]) {
  test(`evaluateQuestionSaveDuplicates (Fix 1): existingQuestions = ${label} does not throw and produces tierAConflict: null`, () => {
    assert.doesNotThrow(() => evaluateQuestionSaveDuplicates({
      question: 'What is the capital of Andhra Pradesh?',
      editingId: undefined,
      existingQuestions: invalidValue,
      nearDuplicateRpcRows: [],
    }))
    const result = evaluateQuestionSaveDuplicates({
      question: 'What is the capital of Andhra Pradesh?',
      editingId: undefined,
      existingQuestions: invalidValue,
      nearDuplicateRpcRows: [],
    })
    assert.equal(result.tierAConflict, null)
  })

  test(`evaluateQuestionSaveDuplicates (Fix 1): existingQuestions = ${label} leaves tierBWarnings behavior unchanged`, () => {
    const result = evaluateQuestionSaveDuplicates({
      question: 'What is the capital?',
      editingId: undefined,
      existingQuestions: invalidValue,
      nearDuplicateRpcRows: [rpcRow({ matched_id: 'e9', similarity: 0.6 })],
    })
    assert.equal(result.tierBWarnings.length, 1)
    assert.equal(result.tierBWarnings[0].matchedId, 'e9')
  })
}

// ── Tier B ────────────────────────────────────────────────────────────

test('evaluateQuestionSaveDuplicates: Tier B RPC rows are formatted through the real formatter', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [rpcRow({ matched_id: 'e9', similarity: 0.55 })],
  })
  assert.equal(result.tierBWarnings.length, 1)
  assert.deepEqual(result.tierBWarnings[0], {
    inputQuestion: 'What is the capital?',
    matchedId: 'e9',
    matchedQuestion: 'What is the capital city?',
    matchedStatus: 'published',
    similarity: 0.55,
  })
})

test('evaluateQuestionSaveDuplicates: a Tier B self-match (matchedId === editingId) is removed during edit', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: 'being-edited',
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'being-edited', similarity: 0.9 }),
      rpcRow({ matched_id: 'someone-else', similarity: 0.5 }),
    ],
  })
  assert.equal(result.tierBWarnings.length, 1)
  assert.equal(result.tierBWarnings[0].matchedId, 'someone-else')
})

// ── Fix 3: Tier B self-exclusion only applies when a real editingId exists ──

test('evaluateQuestionSaveDuplicates (Fix 3): Create with editingId undefined does not remove a warning whose matchedId is undefined', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [rpcRow({ matched_id: undefined, similarity: 0.6 })],
  })
  assert.equal(result.tierBWarnings.length, 1)
})

test('evaluateQuestionSaveDuplicates (Fix 3): Create with editingId null does not remove a warning whose matchedId is null', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: null,
    existingQuestions: [],
    nearDuplicateRpcRows: [rpcRow({ matched_id: null, similarity: 0.6 })],
  })
  assert.equal(result.tierBWarnings.length, 1)
})

test('evaluateQuestionSaveDuplicates (Fix 3): Create preserves all valid formatted Tier B warnings regardless of missing IDs', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: undefined, similarity: 0.9 }),
      rpcRow({ matched_id: null, similarity: 0.8 }),
      rpcRow({ matched_id: 'real-id', similarity: 0.7 }),
    ],
  })
  assert.equal(result.tierBWarnings.length, 3)
})

test('evaluateQuestionSaveDuplicates (Fix 3): Edit with editingId "q-self" removes matchedId "q-self"', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: 'q-self',
    existingQuestions: [],
    nearDuplicateRpcRows: [rpcRow({ matched_id: 'q-self', similarity: 0.6 })],
  })
  assert.equal(result.tierBWarnings.length, 0)
})

test('evaluateQuestionSaveDuplicates (Fix 3): Edit with editingId "q-self" does not remove matchedId undefined, null, or "q-other"', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: 'q-self',
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: undefined, similarity: 0.9 }),
      rpcRow({ matched_id: null, similarity: 0.8 }),
      rpcRow({ matched_id: 'q-other', similarity: 0.7 }),
      rpcRow({ matched_id: 'q-self', similarity: 0.6 }), // this one -- and only this one -- must be removed
    ],
  })
  assert.equal(result.tierBWarnings.length, 3)
  assert.ok(!result.tierBWarnings.some(w => w.matchedId === 'q-self'))
})

test('evaluateQuestionSaveDuplicates (Fix 3): ID comparison remains strict -- a numeric editingId does not exclude a string matchedId of the same digits', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: 1,
    existingQuestions: [],
    nearDuplicateRpcRows: [rpcRow({ matched_id: '1', similarity: 0.6 })],
  })
  assert.equal(result.tierBWarnings.length, 1, '1 !== "1" strictly, so this must NOT be treated as a self-match')
})

test('evaluateQuestionSaveDuplicates: multiple Tier B warnings are ordered by descending similarity', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'low', similarity: 0.46 }),
      rpcRow({ matched_id: 'high', similarity: 0.91 }),
      rpcRow({ matched_id: 'mid', similarity: 0.6 }),
    ],
  })
  assert.deepEqual(result.tierBWarnings.map(w => w.matchedId), ['high', 'mid', 'low'])
})

// ── Fix 2: explicit deterministic Tier B tie-breaker ─────────────────────

test('evaluateQuestionSaveDuplicates (Fix 2): equal similarities are ordered by matchedId ascending, regardless of input order', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'q-b', matched_question: 'B question?', similarity: 0.5 }),
      rpcRow({ matched_id: 'q-a', matched_question: 'A question?', similarity: 0.5 }),
      rpcRow({ matched_id: 'q-c', matched_question: 'C question?', similarity: 0.5 }),
    ],
  })
  assert.deepEqual(result.tierBWarnings.map(w => w.matchedId), ['q-a', 'q-b', 'q-c'])
})

test('evaluateQuestionSaveDuplicates (Fix 2): equal similarity and equal/missing matchedId falls back to matchedQuestion ascending', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined, // the real Create condition -- must not be conflated with a missing matchedId
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: null, matched_question: 'Zebra question?', similarity: 0.5 }),
      rpcRow({ matched_id: null, matched_question: 'Apple question?', similarity: 0.5 }),
      rpcRow({ matched_id: undefined, matched_question: 'Mango question?', similarity: 0.5 }),
    ],
  })
  assert.deepEqual(
    result.tierBWarnings.map(w => w.matchedQuestion),
    ['Apple question?', 'Mango question?', 'Zebra question?']
  )
})

test('evaluateQuestionSaveDuplicates (Fix 2): a different similarity value always takes priority over matchedId ordering', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'z-low-similarity', similarity: 0.46 }),
      rpcRow({ matched_id: 'a-high-similarity', similarity: 0.91 }),
    ],
  })
  // 'a-high-similarity' would sort first alphabetically too -- prove
  // similarity is really what's driving this, not the id tiebreaker, by
  // checking the higher-similarity row wins despite ALSO having the
  // alphabetically-later id in the next test.
  assert.deepEqual(result.tierBWarnings.map(w => w.matchedId), ['a-high-similarity', 'z-low-similarity'])
})

test('evaluateQuestionSaveDuplicates (Fix 2): similarity wins even when the higher-similarity row has the alphabetically LATER id', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'a-low-similarity', similarity: 0.46 }),
      rpcRow({ matched_id: 'z-high-similarity', similarity: 0.91 }),
    ],
  })
  assert.deepEqual(result.tierBWarnings.map(w => w.matchedId), ['z-high-similarity', 'a-low-similarity'])
})

test('evaluateQuestionSaveDuplicates (Fix 2): original RPC row order and objects remain unchanged after sorting', () => {
  const rpcRowsInput = [
    rpcRow({ matched_id: 'q-b', similarity: 0.5 }),
    rpcRow({ matched_id: 'q-a', similarity: 0.5 }),
  ]
  const rpcRowsBefore = JSON.parse(JSON.stringify(rpcRowsInput))

  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: rpcRowsInput,
  })

  assert.deepEqual(rpcRowsInput, rpcRowsBefore, 'input array order and row contents must be untouched')
  assert.deepEqual(result.tierBWarnings.map(w => w.matchedId), ['q-a', 'q-b'], 'output is independently sorted')
})

test('evaluateQuestionSaveDuplicates: a numeric-string similarity is converted and ordered correctly', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'string-sim', similarity: '0.7' }),
      rpcRow({ matched_id: 'number-sim', similarity: 0.5 }),
    ],
  })
  assert.deepEqual(result.tierBWarnings.map(w => w.matchedId), ['string-sim', 'number-sim'])
  assert.equal(typeof result.tierBWarnings[0].similarity, 'number')
})

test('evaluateQuestionSaveDuplicates: invalid similarity rows are removed, not returned as warnings', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'What is the capital?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [
      rpcRow({ matched_id: 'valid', similarity: 0.5 }),
      rpcRow({ matched_id: 'null-sim', similarity: null }),
      rpcRow({ matched_id: 'nan-sim', similarity: 'not-a-number' }),
    ],
  })
  assert.equal(result.tierBWarnings.length, 1)
  assert.equal(result.tierBWarnings[0].matchedId, 'valid')
})

// ── Mutation and shape ───────────────────────────────────────────────────

test('evaluateQuestionSaveDuplicates: existingQuestions and nearDuplicateRpcRows are never mutated', () => {
  const existingQuestionsInput = [existing()]
  const rpcRowsInput = [rpcRow({ matched_id: 'a', similarity: 0.9 }), rpcRow({ matched_id: 'b', similarity: 0.5 })]
  const existingBefore = JSON.parse(JSON.stringify(existingQuestionsInput))
  const rpcRowsBefore = JSON.parse(JSON.stringify(rpcRowsInput))

  evaluateQuestionSaveDuplicates({
    question: 'What is the capital of Andhra Pradesh?',
    editingId: undefined,
    existingQuestions: existingQuestionsInput,
    nearDuplicateRpcRows: rpcRowsInput,
  })

  assert.deepEqual(existingQuestionsInput, existingBefore)
  assert.deepEqual(rpcRowsInput, rpcRowsBefore)
})

test('evaluateQuestionSaveDuplicates: the return object contains exactly tierAConflict and tierBWarnings, no more, no fewer', () => {
  const result = evaluateQuestionSaveDuplicates({
    question: 'Anything?',
    editingId: undefined,
    existingQuestions: [],
    nearDuplicateRpcRows: [],
  })
  assert.deepEqual(Object.keys(result).sort(), ['tierAConflict', 'tierBWarnings'].sort())
})
