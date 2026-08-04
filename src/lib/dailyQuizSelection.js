// ── India-calendar-day-aware, deterministic Daily Quiz question selection ──
//
// Scope: this module only decides WHICH questions show today and in WHAT
// order. It has no persistence, no I/O, and no subject/question-specific
// logic. It does not touch score/answer/progress state -- that stays
// entirely in DailyQuiz.jsx, unchanged.
//
// Design: a deterministic rotation over a stably-sorted pool picks the
// day's SET (guaranteeing every question is shown once before any repeat,
// even when the pool size isn't a multiple of the daily count), then a
// deterministic seeded Fisher–Yates picks that set's display ORDER. Both
// steps are pure functions of (pool, dateKey) -- no non-deterministic
// randomness source, no stored state, so the same day always reproduces
// the same result and a reload never changes anything.

const MS_PER_DAY = 86400000

/**
 * Stable YYYY-MM-DD calendar date in India Standard Time (Asia/Kolkata),
 * regardless of the caller's own local timezone. Uses Intl.DateTimeFormat
 * (the 'en-CA' locale formats as YYYY-MM-DD directly) rather than manual
 * UTC+5:30 offset arithmetic or Date#toDateString(), which is local-
 * timezone-only and was the root cause of the previous selection bug.
 */
export function getIstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Deterministic 32-bit FNV-1a hash of a string. Same input -> same output, always. */
export function hashString(str) {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Content-derived stable identity for a question -- never the array index,
 * which shifts if the question bank is ever reordered/edited.
 */
function stableSortKey(question) {
  const normalized = normalizeText(question.q)
  return { hash: hashString(normalized), normalized }
}

/**
 * Sort comparator for stable-key entries. Primary: the hash. Secondary
 * (tie-breaker): the complete normalized question text -- so sorting stays
 * fully deterministic even in the case of a hash collision, not just in
 * the common case where hashes happen to be unique.
 */
export function compareStableEntries(a, b) {
  if (a.hash !== b.hash) return a.hash - b.hash
  if (a.normalized < b.normalized) return -1
  if (a.normalized > b.normalized) return 1
  return 0
}

/** Sorted by content, not array position. Returns a new array; source untouched. */
export function buildStableSortedPool(pool) {
  return pool
    .map(question => ({ question, ...stableSortKey(question) }))
    .sort(compareStableEntries)
    .map(entry => entry.question)
}

/** Integer day count for an IST date key -- exactly +1 per consecutive calendar day. */
function dayIndexFromDateKey(dateKey) {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / MS_PER_DAY)
}

/** mulberry32: small, fast, deterministic seeded PRNG. Same seed -> same sequence, always. */
export function mulberry32(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher–Yates using an injected deterministic random source (never the
 * built-in non-deterministic RNG, never an unstable comparator-based
 * shuffle). Never mutates
 * `items`; returns a new array. Kept local to this module rather than
 * imported from Mock Test's shuffleQuestions (mockAttemptSelection.js) --
 * the two features are deliberately decoupled; a shared extraction can be
 * a later cleanup if ever needed, not part of this fix.
 */
export function shuffleWithSeed(items, random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * The day's question set, in display order.
 *
 *   empty pool          -> []
 *   pool.length <= count -> every available question (order still varies
 *                           day to day)
 *   pool.length > count  -> a deterministic rotation block of exactly
 *                           effectiveCount questions, walking the stably-
 *                           sorted pool in a contiguous (wrapping) window
 *                           that advances by effectiveCount every calendar
 *                           day
 *
 * Rotation guarantee: every question is shown exactly once before any
 * question is shown a second time. When pool.length is an exact multiple
 * of effectiveCount, this means a clean N-day cycle with zero repeats
 * during it (e.g. 50 questions / 10 per day = a 5-day cycle, day 6 restarts
 * cleanly). When it is NOT an exact multiple (e.g. 53 questions / 10 per
 * day), the day that completes a cycle necessarily contains both: all
 * remaining not-yet-shown questions, AND enough questions from the start
 * of the next rotation to still total effectiveCount -- some repeats on
 * that one day are mathematically unavoidable if the quiz must always
 * contain exactly effectiveCount questions, but they are the ONLY repeats,
 * and only after every question has appeared at least once. This is a
 * direct consequence of using consecutive offsets (with wraparound) into
 * the stably-sorted pool as the window -- no separate cycle-boundary logic
 * is needed to produce this behavior.
 *
 * Display order: the day's set is then shuffled with a Fisher–Yates seeded
 * from a hash of the date key. Same date -> same order. A different date
 * (even one a full rotation cycle later, landing on the same set) normally
 * produces a different order, since the seed is date-derived, not
 * rotation-derived.
 */
export function getDailyQuestionSelection(pool, dateKey, count = 10) {
  if (!Array.isArray(pool) || pool.length === 0) return []

  const effectiveCount = Math.min(count, pool.length)
  const sortedPool = buildStableSortedPool(pool)
  const dayIndex = dayIndexFromDateKey(dateKey)
  const startIndex = dayIndex * effectiveCount

  const todaysSet = []
  for (let i = 0; i < effectiveCount; i += 1) {
    todaysSet.push(sortedPool[(startIndex + i) % sortedPool.length])
  }

  return shuffleWithSeed(todaysSet, mulberry32(hashString(dateKey)))
}
