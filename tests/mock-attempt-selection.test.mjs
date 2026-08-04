// Regression tests for src/lib/mockAttemptSelection.js -- limit
// normalization, the Fisher–Yates shuffle, the pure selector, and the
// sessionStorage persistence/validation layer. Pure functions are tested
// directly; sessionStorage is a Node-only in-memory mock injected via
// globalThis, matching this repo's existing no-DOM-framework test pattern
// (see tests/admin-mock-tests.test.mjs).

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLimit,
  shuffleQuestions,
  selectAttemptQuestions,
  readStoredSelection,
  writeStoredSelection,
  clearStoredSelection,
  validateStoredSelectionPayload,
} from '../src/lib/mockAttemptSelection.js'

function makePool(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `q${i + 1}`, question: `Q${i + 1}` }))
}

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: k => { store.delete(k) },
  }
}

beforeEach(() => {
  globalThis.sessionStorage = createMemoryStorage()
})

// ── normalizeLimit ──────────────────────────────────────────────────────────

test('normalizeLimit: a valid positive integer is respected', () => {
  assert.equal(normalizeLimit(25, 100), 25)
})

test('normalizeLimit: null falls back to the pool length', () => {
  assert.equal(normalizeLimit(null, 40), 40)
})

test('normalizeLimit: undefined falls back to the pool length', () => {
  assert.equal(normalizeLimit(undefined, 40), 40)
})

test('normalizeLimit: NaN falls back to the pool length', () => {
  assert.equal(normalizeLimit(NaN, 40), 40)
})

test('normalizeLimit: zero falls back to the pool length', () => {
  assert.equal(normalizeLimit(0, 40), 40)
})

test('normalizeLimit: a negative value falls back to the pool length', () => {
  assert.equal(normalizeLimit(-5, 40), 40)
})

test('normalizeLimit: a decimal/non-integer falls back to the pool length', () => {
  assert.equal(normalizeLimit(25.5, 40), 40)
})

test('normalizeLimit: a numeric string falls back to the pool length', () => {
  assert.equal(normalizeLimit('25', 40), 40)
})

test('normalizeLimit: a non-numeric string falls back to the pool length', () => {
  assert.equal(normalizeLimit('abc', 40), 40)
})

test('normalizeLimit: an empty pool with an invalid limit returns zero', () => {
  assert.equal(normalizeLimit(null, 0), 0)
})

// ── shuffleQuestions ─────────────────────────────────────────────────────────

test('shuffleQuestions: returns a new array and does not mutate the source', () => {
  const pool = makePool(10)
  const original = [...pool]
  const shuffled = shuffleQuestions(pool, () => 0)
  assert.notEqual(shuffled, pool)
  assert.deepEqual(pool, original)
})

test('shuffleQuestions: the result contains exactly the same items, no more, no fewer', () => {
  const pool = makePool(8)
  const shuffled = shuffleQuestions(pool)
  assert.equal(shuffled.length, pool.length)
  assert.deepEqual(shuffled.map(q => q.id).sort(), pool.map(q => q.id).sort())
})

test('shuffleQuestions: is deterministic given an injected random function', () => {
  const pool = makePool(6)
  const a = shuffleQuestions(pool, () => 0.5)
  const b = shuffleQuestions(pool, () => 0.5)
  assert.deepEqual(a, b)
})

// ── selectAttemptQuestions ───────────────────────────────────────────────────

test('selectAttemptQuestions: an empty pool returns an empty array', () => {
  assert.deepEqual(selectAttemptQuestions([], 25, null), [])
})

test('selectAttemptQuestions: an invalid limit returns the complete shuffled pool', () => {
  const pool = makePool(13)
  const result = selectAttemptQuestions(pool, null, null)
  assert.equal(result.length, 13)
  assert.deepEqual(result.map(q => q.id).sort(), pool.map(q => q.id).sort())
})

test('selectAttemptQuestions: a 100-question pool is capped at a limit of 25', () => {
  const pool = makePool(100)
  const result = selectAttemptQuestions(pool, 25, null)
  assert.equal(result.length, 25)
})

test('selectAttemptQuestions: pool size > limit returns exactly `limit` unique questions, all from the pool', () => {
  const pool = makePool(100)
  const result = selectAttemptQuestions(pool, 25, null)
  assert.equal(result.length, 25)
  const ids = result.map(q => q.id)
  assert.equal(new Set(ids).size, 25)
  const poolIds = new Set(pool.map(q => q.id))
  assert.ok(ids.every(id => poolIds.has(id)))
})

test('selectAttemptQuestions: a small pool (size <= limit) stays complete', () => {
  const pool = makePool(5)
  const result = selectAttemptQuestions(pool, 25, null)
  assert.equal(result.length, 5)
})

test('selectAttemptQuestions: without stored data, a small pool still returns every available question', () => {
  const pool = makePool(5)
  const result = selectAttemptQuestions(pool, 25, null)
  assert.equal(result.length, 5)
  assert.deepEqual(result.map(q => q.id).sort(), pool.map(q => q.id).sort())
})

test('selectAttemptQuestions: does not mutate the source pool', () => {
  const pool = makePool(100)
  const original = [...pool]
  selectAttemptQuestions(pool, 25, null)
  assert.deepEqual(pool, original)
})

test('selectAttemptQuestions: a 5-question pool with limit 25 restores the exact stored order on reload', () => {
  const pool = makePool(5)
  const storedIds = [pool[3].id, pool[0].id, pool[4].id, pool[1].id, pool[2].id]
  const result = selectAttemptQuestions(pool, 25, storedIds)
  assert.deepEqual(result.map(q => q.id), storedIds)
})

test('selectAttemptQuestions: a 25-question pool with limit 25 restores exact stored order', () => {
  const pool = makePool(25)
  const storedIds = shuffleQuestions(pool, () => 0.3).map(q => q.id)
  const result = selectAttemptQuestions(pool, 25, storedIds)
  assert.deepEqual(result.map(q => q.id), storedIds)
})

test('selectAttemptQuestions: a 100-question pool with limit 25 restores exact stored order', () => {
  const pool = makePool(100)
  const storedIds = [pool[24].id, pool[23].id, pool[22].id, ...pool.slice(0, 22).map(q => q.id)]
  assert.equal(storedIds.length, 25)
  assert.equal(new Set(storedIds).size, 25)
  const result = selectAttemptQuestions(pool, 25, storedIds)
  assert.deepEqual(result.map(q => q.id), storedIds)
})

test('selectAttemptQuestions: an invalid limit with a valid full-pool stored selection restores exact order', () => {
  const pool = makePool(10)
  const storedIds = [pool[9].id, pool[0].id, pool[5].id, pool[1].id, pool[2].id, pool[3].id, pool[4].id, pool[6].id, pool[7].id, pool[8].id]
  const result = selectAttemptQuestions(pool, null, storedIds)
  assert.deepEqual(result.map(q => q.id), storedIds)
})

test('selectAttemptQuestions: a stored selection of the wrong length is ignored', () => {
  const pool = makePool(100)
  const storedIds = pool.slice(0, 10).map(q => q.id) // limit is 25, only 10 stored
  const result = selectAttemptQuestions(pool, 25, storedIds)
  assert.equal(result.length, 25)
})

test('selectAttemptQuestions: a stored selection with a duplicate id is ignored', () => {
  const pool = makePool(100)
  const ids = pool.slice(0, 24).map(q => q.id)
  const storedIds = [...ids, ids[0]]
  const result = selectAttemptQuestions(pool, 25, storedIds)
  assert.equal(new Set(result.map(q => q.id)).size, 25)
  assert.notDeepEqual(result.map(q => q.id), storedIds)
})

test('selectAttemptQuestions: a stored selection with a stale/unknown id is ignored', () => {
  const pool = makePool(100)
  const ids = pool.slice(0, 24).map(q => q.id)
  const storedIds = [...ids, 'not-a-real-id']
  const result = selectAttemptQuestions(pool, 25, storedIds)
  assert.equal(result.length, 25)
  assert.ok(!result.some(q => q.id === 'not-a-real-id'))
})

// ── validateStoredSelectionPayload ───────────────────────────────────────────

const validationPool = makePool(30)
const validIds = validationPool.slice(0, 25).map(q => q.id)

test('validateStoredSelectionPayload: a valid payload is accepted', () => {
  const payload = { version: 1, testId: 'indian-geography', questionIds: validIds }
  assert.deepEqual(
    validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25),
    validIds
  )
})

test('validateStoredSelectionPayload: a wrong testId is rejected', () => {
  const payload = { version: 1, testId: 'other-test', questionIds: validIds }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: a missing version is rejected', () => {
  const payload = { testId: 'indian-geography', questionIds: validIds }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: a wrong version is rejected', () => {
  const payload = { version: 2, testId: 'indian-geography', questionIds: validIds }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: questionIds not being an array is rejected', () => {
  const payload = { version: 1, testId: 'indian-geography', questionIds: 'not-an-array' }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: the wrong length is rejected', () => {
  const payload = { version: 1, testId: 'indian-geography', questionIds: validIds.slice(0, 10) }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: an empty-string id is rejected', () => {
  const ids = [...validIds.slice(0, 24), '']
  const payload = { version: 1, testId: 'indian-geography', questionIds: ids }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: a duplicate id is rejected', () => {
  const ids = [...validIds.slice(0, 24), validIds[0]]
  const payload = { version: 1, testId: 'indian-geography', questionIds: ids }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: a stale id not in the current pool is rejected', () => {
  const ids = [...validIds.slice(0, 24), 'stale-id-from-old-pool']
  const payload = { version: 1, testId: 'indian-geography', questionIds: ids }
  assert.equal(validateStoredSelectionPayload(payload, 'indian-geography', validationPool, 25), null)
})

test('validateStoredSelectionPayload: a null payload (nothing stored) is rejected without throwing', () => {
  assert.equal(validateStoredSelectionPayload(null, 'indian-geography', validationPool, 25), null)
})

// ── sessionStorage helpers ───────────────────────────────────────────────────

test('readStoredSelection: malformed JSON in storage is handled -- returns null, does not throw', () => {
  globalThis.sessionStorage.setItem('mock_attempt_selection_indian-geography', '{not valid json')
  assert.equal(readStoredSelection('indian-geography'), null)
})

test('readStoredSelection: nothing stored returns null', () => {
  assert.equal(readStoredSelection('indian-geography'), null)
})

test('writeStoredSelection then readStoredSelection round-trips the payload', () => {
  writeStoredSelection('indian-geography', ['q1', 'q2'])
  assert.deepEqual(readStoredSelection('indian-geography'), {
    version: 1, testId: 'indian-geography', questionIds: ['q1', 'q2'],
  })
})

test('clearStoredSelection removes the entry', () => {
  writeStoredSelection('indian-geography', ['q1'])
  clearStoredSelection('indian-geography')
  assert.equal(readStoredSelection('indian-geography'), null)
})

test('readStoredSelection: a throwing getItem is handled -- returns null, does not throw', () => {
  globalThis.sessionStorage = { getItem() { throw new Error('boom') } }
  assert.doesNotThrow(() => readStoredSelection('indian-geography'))
  assert.equal(readStoredSelection('indian-geography'), null)
})

test('writeStoredSelection: a throwing setItem is swallowed, does not throw', () => {
  globalThis.sessionStorage = { setItem() { throw new Error('quota exceeded') } }
  assert.doesNotThrow(() => writeStoredSelection('indian-geography', ['q1']))
})

test('clearStoredSelection: a throwing removeItem is swallowed, does not throw', () => {
  globalThis.sessionStorage = { removeItem() { throw new Error('boom') } }
  assert.doesNotThrow(() => clearStoredSelection('indian-geography'))
})

test('storage keys are namespaced per testId -- different tests never collide', () => {
  writeStoredSelection('indian-geography', ['g1'])
  writeStoredSelection('indian-history', ['h1'])
  assert.deepEqual(readStoredSelection('indian-geography').questionIds, ['g1'])
  assert.deepEqual(readStoredSelection('indian-history').questionIds, ['h1'])
})

test('Retry-style clearing leaves nothing to restore on the next read', () => {
  writeStoredSelection('indian-geography', ['q1', 'q2'])
  clearStoredSelection('indian-geography')
  assert.equal(readStoredSelection('indian-geography'), null)
})
