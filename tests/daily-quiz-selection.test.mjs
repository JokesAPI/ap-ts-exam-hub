// Regression tests for src/lib/dailyQuizSelection.js -- the India-calendar
// -day-aware, deterministic Daily Quiz question selection fix. Pure
// functions are tested directly with node's built-in test runner, matching
// this repo's existing no-DOM-framework test pattern.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getIstDateKey,
  hashString,
  compareStableEntries,
  buildStableSortedPool,
  mulberry32,
  shuffleWithSeed,
  getDailyQuestionSelection,
} from '../src/lib/dailyQuizSelection.js'

function makePool(n) {
  return Array.from({ length: n }, (_, i) => ({
    q: `Question number ${i + 1} — unique text body ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    ans: 0,
    exp: `Explanation ${i + 1}`,
  }))
}

// ── IST date key ─────────────────────────────────────────────────────────────

test('getIstDateKey: 18:29:59 UTC is still Aug 4 in IST', () => {
  assert.equal(getIstDateKey(new Date('2026-08-04T18:29:59Z')), '2026-08-04')
})

test('getIstDateKey: 18:30:00 UTC has rolled over to Aug 5 in IST (midnight IST)', () => {
  assert.equal(getIstDateKey(new Date('2026-08-04T18:30:00Z')), '2026-08-05')
})

test('getIstDateKey: always returns a YYYY-MM-DD shaped string', () => {
  assert.match(getIstDateKey(new Date('2026-01-15T09:00:00Z')), /^\d{4}-\d{2}-\d{2}$/)
})

// ── stable hash / stable sort key ───────────────────────────────────────────

test('hashString: the same text always produces the same hash', () => {
  const text = 'Who is the current Chief Minister of Andhra Pradesh?'
  assert.equal(hashString(text), hashString(text))
})

test('hashString: two distinct known texts do not collide', () => {
  assert.notEqual(
    hashString('Which river is called the Lifeline of Andhra Pradesh?'),
    hashString('APPSC stands for?')
  )
})

test('compareStableEntries: falls back to normalized text when hashes collide (collision-safe, deterministic)', () => {
  const a = { hash: 42, normalized: 'alpha question text' }
  const b = { hash: 42, normalized: 'beta question text' }
  assert.ok(compareStableEntries(a, b) < 0)
  assert.ok(compareStableEntries(b, a) > 0)
  assert.equal(compareStableEntries(a, a), 0)
})

test('buildStableSortedPool: ordering is stable across repeated calls (not array-index-based)', () => {
  const pool = makePool(20)
  const sortedA = buildStableSortedPool(pool)
  const sortedB = buildStableSortedPool([...pool].reverse())
  assert.deepEqual(sortedA.map(q => q.q), sortedB.map(q => q.q))
})

test('buildStableSortedPool: does not mutate the source pool', () => {
  const pool = makePool(10)
  const original = [...pool]
  buildStableSortedPool(pool)
  assert.deepEqual(pool, original)
})

// ── shuffle ──────────────────────────────────────────────────────────────────

test('shuffleWithSeed: deterministic for a supplied seed', () => {
  const pool = makePool(10)
  const a = shuffleWithSeed(pool, mulberry32(12345))
  const b = shuffleWithSeed(pool, mulberry32(12345))
  assert.deepEqual(a, b)
})

test('shuffleWithSeed: membership is unchanged, only order may differ', () => {
  const pool = makePool(10)
  const shuffled = shuffleWithSeed(pool, mulberry32(999))
  assert.equal(shuffled.length, pool.length)
  assert.deepEqual(shuffled.map(q => q.q).sort(), pool.map(q => q.q).sort())
})

test('shuffleWithSeed: does not mutate the source array', () => {
  const pool = makePool(10)
  const original = [...pool]
  shuffleWithSeed(pool, mulberry32(1))
  assert.deepEqual(pool, original)
})

test('source file never uses Math.random or sort(() => Math.random() - 0.5)', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/dailyQuizSelection.js'), 'utf8')
  assert.ok(!src.includes('Math.random'), 'Math.random must not appear in dailyQuizSelection.js')
})

// ── daily selection: general behavior ───────────────────────────────────────

test('getDailyQuestionSelection: an empty pool returns an empty array', () => {
  assert.deepEqual(getDailyQuestionSelection([], '2026-08-04'), [])
})

test('getDailyQuestionSelection: the same date called twice gives identical ids and order', () => {
  const pool = makePool(50)
  const a = getDailyQuestionSelection(pool, '2026-08-04')
  const b = getDailyQuestionSelection(pool, '2026-08-04')
  assert.deepEqual(a.map(q => q.q), b.map(q => q.q))
})

test('getDailyQuestionSelection: does not mutate the source pool', () => {
  const pool = makePool(50)
  const original = [...pool]
  getDailyQuestionSelection(pool, '2026-08-04')
  assert.deepEqual(pool, original)
})

test('getDailyQuestionSelection: a pool smaller than the count returns every available question', () => {
  const pool = makePool(5)
  const result = getDailyQuestionSelection(pool, '2026-08-04')
  assert.equal(result.length, 5)
  assert.deepEqual(result.map(q => q.q).sort(), pool.map(q => q.q).sort())
})

test('getDailyQuestionSelection: each daily result has no duplicate question within that day', () => {
  const pool = makePool(50)
  for (const dateKey of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']) {
    const result = getDailyQuestionSelection(pool, dateKey)
    assert.equal(new Set(result.map(q => q.q)).size, result.length)
  }
})

test('getDailyQuestionSelection: consecutive days select disjoint sets (next day is the next rotation block)', () => {
  const pool = makePool(50)
  const day1 = getDailyQuestionSelection(pool, '2026-01-01')
  const day2 = getDailyQuestionSelection(pool, '2026-01-02')
  const day1Ids = new Set(day1.map(q => q.q))
  const day2Ids = new Set(day2.map(q => q.q))
  const overlap = [...day1Ids].filter(id => day2Ids.has(id))
  assert.equal(overlap.length, 0)
})

// ── daily selection: the real 50-question pool's 5-day cycle ───────────────

test('getDailyQuestionSelection: 50-question pool has zero repeats across 5 consecutive days, all 50 shown exactly once', () => {
  const pool = makePool(50)
  const dateKeys = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']
  const seenCounts = new Map()
  for (const dateKey of dateKeys) {
    const result = getDailyQuestionSelection(pool, dateKey)
    assert.equal(result.length, 10)
    for (const question of result) {
      seenCounts.set(question.q, (seenCounts.get(question.q) || 0) + 1)
    }
  }
  assert.equal(seenCounts.size, 50, 'all 50 questions must have appeared')
  for (const count of seenCounts.values()) {
    assert.equal(count, 1, 'no question may appear more than once across the 5-day cycle')
  }
})

test('getDailyQuestionSelection: the 6th day starts a new cycle -- same set as day 1', () => {
  const pool = makePool(50)
  const day1 = getDailyQuestionSelection(pool, '2026-03-01')
  const day6 = getDailyQuestionSelection(pool, '2026-03-06')
  assert.deepEqual(
    day1.map(q => q.q).sort(),
    day6.map(q => q.q).sort(),
    'day 6 must select the exact same 10-question set as day 1 (new cycle)'
  )
})

// ── daily selection: non-divisible pool (53 questions, 10 per day) ─────────

test('getDailyQuestionSelection: a 53-question pool follows the documented non-divisible rule', () => {
  const pool = makePool(53)
  const dateKeys = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06']
  const seen = new Set()
  const repeatsPerDay = []

  for (const dateKey of dateKeys) {
    const result = getDailyQuestionSelection(pool, dateKey)
    assert.equal(result.length, 10, 'every day must still contain exactly 10 questions')
    assert.equal(new Set(result.map(q => q.q)).size, 10, 'no duplicate within a single day')

    let repeats = 0
    for (const question of result) {
      if (seen.has(question.q)) repeats += 1
      else seen.add(question.q)
    }
    repeatsPerDay.push(repeats)
  }

  // Days 1-5 (indices 0-4) are entirely fresh: 50 of the 53 questions shown, zero repeats.
  assert.deepEqual(repeatsPerDay.slice(0, 5), [0, 0, 0, 0, 0])
  // Day 6 (index 5) is the cycle-completing day: 3 remaining unseen questions
  // are included first, then exactly 7 repeats fill the rest of that day's
  // required 10 -- matching 53 questions / 10 per day exactly.
  assert.equal(repeatsPerDay[5], 7)
  // By the end of day 6, every one of the 53 questions has appeared at least once.
  assert.equal(seen.size, 53)
})

test('getDailyQuestionSelection: the 53-question, cycle-completing day is deterministic across repeated calls', () => {
  const pool = makePool(53)
  const a = getDailyQuestionSelection(pool, '2026-05-06')
  const b = getDailyQuestionSelection(pool, '2026-05-06')
  assert.deepEqual(a.map(q => q.q), b.map(q => q.q))
})
