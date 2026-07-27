// Regression check for src/lib/performance.js's getMissionDetails().
//
// Phase 8.2 fix target: Estimated Time must be based on the FULL published
// question count for a test, never on the subset that happens to carry a
// difficulty value. Enterprise QuestionBank bulk imports (Phase 8.0/8.1)
// always store difficulty as NULL, so as bulk-imported content grows, a
// test can have many real published questions with none of them carrying
// difficulty -- the old implementation silently undercounted the estimate
// in that case. Difficulty itself must now only be shown when EVERY row
// has a value; partial coverage is treated the same as no coverage.
//
// getStudyGoal()/getWeakestSubject()/isCompletedToday() are untouched by
// this phase and are not re-tested here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { getMissionDetails } from '../src/lib/performance.js'

function makeRows(count, { difficulty = null } = {}) {
  return Array.from({ length: count }, () => ({ difficulty }))
}

test('1. twenty rows, all with a populated difficulty', () => {
  const rows = [
    ...makeRows(12, { difficulty: 'medium' }),
    ...makeRows(8, { difficulty: 'easy' }),
  ]
  const result = getMissionDetails(rows)
  assert.equal(result.estimatedMinutes, Math.max(1, Math.round((20 * 45) / 60)))
  assert.equal(result.difficulty, 'medium') // most frequent value
})

test('2. twenty rows, all difficulty NULL', () => {
  const rows = makeRows(20, { difficulty: null })
  const result = getMissionDetails(rows)
  assert.equal(result.estimatedMinutes, Math.max(1, Math.round((20 * 45) / 60)))
  assert.equal(result.difficulty, undefined)
})

test('3. twenty rows, 5 populated / 15 NULL difficulty (mixed/partial coverage)', () => {
  const rows = [
    ...makeRows(5, { difficulty: 'hard' }),
    ...makeRows(15, { difficulty: null }),
  ]
  const result = getMissionDetails(rows)
  assert.equal(result.estimatedMinutes, Math.max(1, Math.round((20 * 45) / 60)))
  assert.equal(result.difficulty, undefined) // partial coverage -> hidden, not misleading
})

test('4. empty input returns null (existing empty-state behavior preserved)', () => {
  assert.equal(getMissionDetails([]), null)
  assert.equal(getMissionDetails(null), null)
  assert.equal(getMissionDetails(undefined), null)
})

test('5. a single classified question', () => {
  const rows = [{ difficulty: 'easy' }]
  const result = getMissionDetails(rows)
  assert.equal(result.estimatedMinutes, Math.max(1, Math.round((1 * 45) / 60)))
  assert.equal(result.difficulty, 'easy')
})

test('6. existing rounding behavior is preserved exactly (Math.max(1, Math.round(count*45/60)))', () => {
  // 1 question -> 45s -> rounds to 1min, floor-guarded anyway
  assert.equal(getMissionDetails(makeRows(1)).estimatedMinutes, 1)
  // 2 questions -> 90s -> 1.5min -> rounds to 2
  assert.equal(getMissionDetails(makeRows(2)).estimatedMinutes, 2)
  // 3 questions -> 135s -> 2.25min -> rounds to 2
  assert.equal(getMissionDetails(makeRows(3)).estimatedMinutes, 2)
  // 30 questions -> 1350s -> 22.5min -> rounds to 23 (banker's-none, JS round-half-up)
  assert.equal(getMissionDetails(makeRows(30)).estimatedMinutes, Math.round(1350 / 60))
})

test('7. input array is never mutated', () => {
  const rows = [{ difficulty: 'easy' }, { difficulty: null }, { difficulty: 'hard' }]
  const snapshot = JSON.parse(JSON.stringify(rows))
  getMissionDetails(rows)
  assert.deepEqual(rows, snapshot)
})

test('8. complete coverage returns the existing mode-based difficulty', () => {
  const rows = [
    ...makeRows(3, { difficulty: 'hard' }),
    ...makeRows(2, { difficulty: 'easy' }),
  ]
  const result = getMissionDetails(rows)
  assert.equal(result.difficulty, 'hard') // 3 > 2, most frequent wins
})

test('9. mixed or missing coverage returns no difficulty (key absent/undefined, never a guessed value)', () => {
  const partial = getMissionDetails([{ difficulty: 'easy' }, { difficulty: null }])
  assert.equal(partial.difficulty, undefined)

  const none = getMissionDetails([{ difficulty: null }, { difficulty: undefined }])
  assert.equal(none.difficulty, undefined)
})

test('for equal row counts, Estimated Time is identical regardless of difficulty coverage', () => {
  const fullCoverage = getMissionDetails(makeRows(20, { difficulty: 'medium' }))
  const noCoverage = getMissionDetails(makeRows(20, { difficulty: null }))
  const partialCoverage = getMissionDetails([
    ...makeRows(5, { difficulty: 'medium' }),
    ...makeRows(15, { difficulty: null }),
  ])
  assert.equal(fullCoverage.estimatedMinutes, noCoverage.estimatedMinutes)
  assert.equal(fullCoverage.estimatedMinutes, partialCoverage.estimatedMinutes)
})
