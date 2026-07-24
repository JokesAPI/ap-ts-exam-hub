// Phase 8.3 Step 5 -- tests for the pure decision helper backing Publish/
// Bulk Publish Tier A duplicate validation in AdminQuestions.jsx's
// bulkSetStatus('published').
//
// bulkSetStatus() itself is a React closure over component state and
// can't be exercised without a browser/React test framework -- see the
// source-code audit in the accompanying report for that half of the
// verification. These tests import and exercise the REAL
// evaluatePublishConflicts export, which itself reuses the real
// findExactDuplicates from contentValidation.js -- no normalization or
// duplicate-comparison logic is reimplemented here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePublishConflicts } from '../src/lib/adminQuestionPublishValidation.js'

function selected(overrides = {}) {
  return { id: 'sel-1', test_id: 'indian-polity', question: 'What is the capital of Andhra Pradesh?', status: 'draft', ...overrides }
}

function published(overrides = {}) {
  return { id: 'pub-1', test_id: 'indian-polity', question: 'What is the capital of Andhra Pradesh?', status: 'published', ...overrides }
}

const APPROVED_CONFLICT_KEYS = [
  'selectedId', 'selectedQuestion', 'testId', 'conflictType',
  'matchedPublishedId', 'matchedSelectedId', 'matchedSelectedQuestion',
].sort()

// ── 1-6: basic published-vs-selected detection ──────────────────────────

test('evaluatePublishConflicts: 1. a clean selected question returns no conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: 'A totally new question?' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ question: 'Something else entirely?' })] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts: 2. an exact selected-vs-published duplicate is detected', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected()],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'published')
})

test('evaluatePublishConflicts: 3. a case-only selected-vs-published duplicate is detected', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: 'WHAT IS THE CAPITAL OF ANDHRA PRADESH?' })],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'published')
})

test('evaluatePublishConflicts: 4. a whitespace-only selected-vs-published duplicate is detected', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: '  What is   the capital of Andhra   Pradesh?  ' })],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'published')
})

test('evaluatePublishConflicts: 5. a punctuation difference is allowed', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: 'What is the capital of Andhra Pradesh' })], // no '?'
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts: 6. the same text in another test_id is allowed', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ test_id: 'general-science' })],
    publishedQuestionsByTestId: { 'indian-polity': [published()] }, // different test_id
  })
  assert.equal(conflicts.length, 0)
})

// ── 7-8: self-exclusion ──────────────────────────────────────────────────

test('evaluatePublishConflicts: 7. a self-match by identical id is ignored', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'same-id' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ id: 'same-id' })] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts: 8. another published record with the same text still conflicts after self is excluded', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'same-id' })],
    publishedQuestionsByTestId: {
      'indian-polity': [
        published({ id: 'same-id' }), // self -- excluded
        published({ id: 'a-different-published-row' }), // genuine conflict
      ],
    },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].matchedPublishedId, 'a-different-published-row')
})

// ── 9-11: selection-batch conflicts ──────────────────────────────────────

test('evaluatePublishConflicts: 9. two identical selected drafts create one selection conflict on the later row', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'first' }), selected({ id: 'second' })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].selectedId, 'second')
  assert.equal(conflicts[0].conflictType, 'selection')
  assert.equal(conflicts[0].matchedSelectedId, 'first')
})

test('evaluatePublishConflicts: 10. case/whitespace selected-batch duplicates are detected', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [
      selected({ id: 'first' }),
      selected({ id: 'second', question: '  WHAT IS THE   CAPITAL OF ANDHRA PRADESH?  ' }),
    ],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'selection')
})

test('evaluatePublishConflicts: 11. three repeated selected rows report the second and third conflicts, in order', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'a' }), selected({ id: 'b' }), selected({ id: 'c' })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 2)
  assert.deepEqual(conflicts.map(c => c.selectedId), ['b', 'c'])
  assert.deepEqual(conflicts.map(c => c.matchedSelectedId), ['a', 'a'])
})

// ── 12-14: priority, isolation, ordering ─────────────────────────────────

test('evaluatePublishConflicts: 12. a published conflict takes priority over a selected-batch conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'a' }), selected({ id: 'b' })],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 2)
  assert.equal(conflicts[0].conflictType, 'published')
  assert.equal(conflicts[1].conflictType, 'published')
})

test('evaluatePublishConflicts: 13. multiple test_id groups remain isolated', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [
      selected({ id: 'a', test_id: 'indian-polity' }),
      selected({ id: 'b', test_id: 'general-science', question: 'General science question?' }),
    ],
    publishedQuestionsByTestId: {
      'indian-polity': [published({ id: 'pub-polity' })],
      // no entry at all for general-science
    },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].selectedId, 'a')
})

test('evaluatePublishConflicts: 14. conflict output follows selectedQuestions order, even across interleaved test_id groups', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [
      selected({ id: 'a', test_id: 'general-science', question: 'GS dup?' }), // index 0
      selected({ id: 'b', test_id: 'indian-polity' }),                        // index 1 -- clean
      selected({ id: 'c', test_id: 'general-science', question: 'GS dup?' }), // index 2 -- selection conflict with a
    ],
    publishedQuestionsByTestId: {},
  })
  assert.deepEqual(conflicts.map(c => c.selectedId), ['c'])
})

// ── 15-19: lookup robustness ──────────────────────────────────────────────

test('evaluatePublishConflicts: 15. a plain-object published lookup works', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected()],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 1)
})

test('evaluatePublishConflicts: 16. a Map published lookup works', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected()],
    publishedQuestionsByTestId: new Map([['indian-polity', [published()]]]),
  })
  assert.equal(conflicts.length, 1)
})

test('evaluatePublishConflicts: 17. a missing lookup key behaves as empty', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ test_id: 'not-in-lookup' })],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts: 18. an invalid lookup value behaves as empty, never throws', () => {
  for (const invalidValue of ['not-an-array', {}, 42, null, undefined]) {
    assert.doesNotThrow(() => evaluatePublishConflicts({
      selectedQuestions: [selected()],
      publishedQuestionsByTestId: { 'indian-polity': invalidValue },
    }))
    const conflicts = evaluatePublishConflicts({
      selectedQuestions: [selected()],
      publishedQuestionsByTestId: { 'indian-polity': invalidValue },
    })
    assert.equal(conflicts.length, 0)
  }
})

test('evaluatePublishConflicts: 19. null/undefined inputs behave safely, never throw', () => {
  for (const badSelected of [null, undefined, 'not-an-array', 42]) {
    assert.doesNotThrow(() => evaluatePublishConflicts({ selectedQuestions: badSelected, publishedQuestionsByTestId: {} }))
  }
  for (const badLookup of [null, undefined, 'not-an-object', 42]) {
    assert.doesNotThrow(() => evaluatePublishConflicts({ selectedQuestions: [selected()], publishedQuestionsByTestId: badLookup }))
  }
})

// ── 20: prototype-risk test_id keys ──────────────────────────────────────

for (const riskyTestId of ['__proto__', 'constructor', 'toString']) {
  test(`evaluatePublishConflicts: 20. a resolved test_id of "${riskyTestId}" works safely with Object.create(null)`, () => {
    const publishedQuestionsByTestId = Object.create(null)
    publishedQuestionsByTestId[riskyTestId] = [published({ test_id: riskyTestId })]
    const conflicts = evaluatePublishConflicts({
      selectedQuestions: [selected({ test_id: riskyTestId })],
      publishedQuestionsByTestId,
    })
    assert.equal(conflicts.length, 1)
    assert.equal(conflicts[0].testId, riskyTestId)
  })

  test(`evaluatePublishConflicts: 20b. a resolved test_id of "${riskyTestId}" works safely with a plain {} lookup too`, () => {
    const conflicts = evaluatePublishConflicts({
      selectedQuestions: [selected({ test_id: riskyTestId, question: 'A brand new question?' })],
      publishedQuestionsByTestId: {}, // plain {}, deliberately not null-prototype
    })
    assert.equal(conflicts.length, 0) // no real published data supplied -- must not throw or false-positive
  })
}

// ── 21: no mutation ───────────────────────────────────────────────────────

test('evaluatePublishConflicts: 21. caller arrays, Maps, objects, and records are not mutated', () => {
  const selectedInput = [selected({ id: 'a' }), selected({ id: 'b' })]
  const selectedBefore = JSON.parse(JSON.stringify(selectedInput))

  const objectLookup = { 'indian-polity': [published()] }
  const objectLookupBefore = JSON.parse(JSON.stringify(objectLookup))

  evaluatePublishConflicts({ selectedQuestions: selectedInput, publishedQuestionsByTestId: objectLookup })
  assert.deepEqual(selectedInput, selectedBefore)
  assert.deepEqual(objectLookup, objectLookupBefore)

  const mapRecord = published()
  const mapRecordBefore = JSON.parse(JSON.stringify(mapRecord))
  const mapLookup = new Map([['indian-polity', [mapRecord]]])
  evaluatePublishConflicts({ selectedQuestions: [selected()], publishedQuestionsByTestId: mapLookup })
  assert.equal(mapLookup.size, 1)
  assert.deepEqual(mapRecord, mapRecordBefore)
})

// ── 22-23: exact conflict object shape ────────────────────────────────────

test('evaluatePublishConflicts: 22. a published conflict object contains exactly the approved fields', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected()],
    publishedQuestionsByTestId: { 'indian-polity': [published()] },
  })
  assert.deepEqual(Object.keys(conflicts[0]).sort(), APPROVED_CONFLICT_KEYS)
  assert.deepEqual(conflicts[0], {
    selectedId: 'sel-1',
    selectedQuestion: 'What is the capital of Andhra Pradesh?',
    testId: 'indian-polity',
    conflictType: 'published',
    matchedPublishedId: 'pub-1',
    matchedSelectedId: null,
    matchedSelectedQuestion: null,
  })
})

test('evaluatePublishConflicts: 23. a selection conflict object contains exactly the approved fields', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'first' }), selected({ id: 'second' })],
    publishedQuestionsByTestId: {},
  })
  assert.deepEqual(Object.keys(conflicts[0]).sort(), APPROVED_CONFLICT_KEYS)
  assert.deepEqual(conflicts[0], {
    selectedId: 'second',
    selectedQuestion: 'What is the capital of Andhra Pradesh?',
    testId: 'indian-polity',
    conflictType: 'selection',
    matchedPublishedId: null,
    matchedSelectedId: 'first',
    matchedSelectedQuestion: 'What is the capital of Andhra Pradesh?',
  })
})

// ── 24-25: malformed/duplicate input safety ───────────────────────────────

test('evaluatePublishConflicts: 24. invalid selected rows with a missing question do not create false conflicts', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [
      selected({ id: 'no-question', question: undefined }),
      selected({ id: 'also-blank', question: null }),
    ],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts: 25. the same id appearing twice does not create a false self-conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'dup' }), selected({ id: 'dup' })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 0, 'the same underlying record referenced twice is not a real duplicate pair')
})

test('evaluatePublishConflicts: 25b. distinct selected records with the same text still legitimately conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'a' }), selected({ id: 'b' })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].selectedId, 'b')
})

// ── Missing-ID self-exclusion correction ─────────────────────────────────

test('evaluatePublishConflicts (missing-ID fix): empty-string selected and published questions do not conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: '' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ question: '' })] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts (missing-ID fix): a published question of undefined does not conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: 'Real question?' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ question: undefined })] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts (missing-ID fix): a published question of null does not conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: 'Real question?' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ question: null })] },
  })
  assert.equal(conflicts.length, 0)
})

test("evaluatePublishConflicts (missing-ID fix): a published question of '' does not conflict", () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ question: 'Real question?' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ question: '' })] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts (missing-ID fix): the same real selected ID repeated three times produces no conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'x' }), selected({ id: 'x' }), selected({ id: 'x' })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts (missing-ID fix): two selected rows with id: undefined and identical questions produce one selection conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: undefined }), selected({ id: undefined })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'selection')
  assert.equal(conflicts[0].selectedId, undefined)
  assert.equal(conflicts[0].matchedSelectedId, undefined)
})

test('evaluatePublishConflicts (missing-ID fix): two selected rows with id: null and identical questions produce one selection conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: null }), selected({ id: null })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'selection')
  assert.equal(conflicts[0].selectedId, null)
  assert.equal(conflicts[0].matchedSelectedId, null)
})

test('evaluatePublishConflicts (missing-ID fix): a selected row with a missing ID and a published row with a missing ID, identical questions, produce one published conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: undefined })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ id: undefined })] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'published')
  assert.equal(conflicts[0].matchedPublishedId, undefined)
})

test('evaluatePublishConflicts (missing-ID fix): a real selected UUID excludes the same real published UUID', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'same-real-id' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ id: 'same-real-id' })] },
  })
  assert.equal(conflicts.length, 0)
})

test('evaluatePublishConflicts (missing-ID fix): a missing selected ID does not exclude a published row with a real UUID', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: undefined })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ id: 'a-real-published-id' })] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'published')
  assert.equal(conflicts[0].matchedPublishedId, 'a-real-published-id')
})

test('evaluatePublishConflicts (missing-ID fix): a real selected ID does not exclude a published row with a missing ID', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'a-real-selected-id' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ id: undefined })] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].conflictType, 'published')
  assert.equal(conflicts[0].matchedPublishedId, undefined)
})

test('evaluatePublishConflicts (missing-ID fix): different real IDs with identical questions still produce a conflict', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: 'real-a' })],
    publishedQuestionsByTestId: { 'indian-polity': [published({ id: 'real-b' })] },
  })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].matchedPublishedId, 'real-b')
})

test('evaluatePublishConflicts (missing-ID fix): inputs remain unmodified across all missing-ID scenarios', () => {
  const selectedInput = [selected({ id: undefined }), selected({ id: null })]
  const selectedBefore = JSON.parse(JSON.stringify(selectedInput, (k, v) => (v === undefined ? '__undefined__' : v)))
  const publishedLookup = { 'indian-polity': [published({ id: undefined }), published({ id: null })] }
  const publishedBefore = JSON.parse(JSON.stringify(publishedLookup, (k, v) => (v === undefined ? '__undefined__' : v)))

  evaluatePublishConflicts({ selectedQuestions: selectedInput, publishedQuestionsByTestId: publishedLookup })

  assert.deepEqual(
    JSON.parse(JSON.stringify(selectedInput, (k, v) => (v === undefined ? '__undefined__' : v))),
    selectedBefore
  )
  assert.deepEqual(
    JSON.parse(JSON.stringify(publishedLookup, (k, v) => (v === undefined ? '__undefined__' : v))),
    publishedBefore
  )
})

test('evaluatePublishConflicts (missing-ID fix): a missing-ID conflict object still contains exactly the seven approved fields', () => {
  const conflicts = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: undefined }), selected({ id: undefined })],
    publishedQuestionsByTestId: {},
  })
  assert.deepEqual(Object.keys(conflicts[0]).sort(), APPROVED_CONFLICT_KEYS)
})

test('evaluatePublishConflicts (missing-ID fix): missing IDs are preserved exactly in the output, never normalized into invented strings', () => {
  const undefinedCase = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: undefined }), selected({ id: undefined })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(undefinedCase[0].selectedId, undefined)
  assert.equal(undefinedCase[0].matchedSelectedId, undefined)
  assert.notEqual(undefinedCase[0].selectedId, 'undefined') // must not become the string "undefined"
  assert.notEqual(undefinedCase[0].selectedId, null) // must not become null either

  const nullCase = evaluatePublishConflicts({
    selectedQuestions: [selected({ id: null }), selected({ id: null })],
    publishedQuestionsByTestId: {},
  })
  assert.equal(nullCase[0].selectedId, null)
  assert.equal(nullCase[0].matchedSelectedId, null)
  assert.notEqual(nullCase[0].selectedId, 'null') // must not become the string "null"
})
