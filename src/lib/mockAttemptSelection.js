// ── Mock test attempt selection — pure question sampling + sessionStorage persistence ──
//
// Scope (Phase 12): this module keeps the *set and order* of an attempt's
// questions stable across a reload, nothing more. Answers, current question
// index, and the timer are NOT persisted here and reset on every reload --
// see MockTestEngine.jsx. This is not full resume support.
//
// selectAttemptQuestions() has no test_id-specific logic: every test in the
// catalog is sampled the same way, driven only by its own
// questions_per_attempt value and its own published pool.

const STORAGE_VERSION = 1

/**
 * A configured limit is only honored when it is a positive integer. Any
 * other runtime value (null, undefined, NaN, zero, negative, a decimal, a
 * string, a missing column) falls back to the full pool -- never to a
 * hardcoded default and never to zero.
 */
export function normalizeLimit(limit, poolLength) {
  return Number.isInteger(limit) && limit > 0 ? limit : poolLength
}

/** Fisher–Yates shuffle. Never mutates `items`; returns a new array. */
export function shuffleQuestions(items, random = Math.random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Restore a previously-stored order, but only if it exactly matches this
 * pool: right length (effectiveCount), no duplicates, every id present. Any
 * mismatch returns null so the caller falls back to a fresh shuffle -- never
 * a partial or mixed result.
 */
export function restoreStoredOrder(pool, storedIds, effectiveCount) {
  if (!Array.isArray(storedIds) || storedIds.length !== effectiveCount) return null

  const byId = new Map(pool.map(q => [q.id, q]))
  const seen = new Set()
  const restored = []

  for (const id of storedIds) {
    if (seen.has(id) || !byId.has(id)) return null
    seen.add(id)
    restored.push(byId.get(id))
  }

  return restored
}

/**
 * Pure selection. No I/O, no test_id branching.
 *
 * effectiveCount = min(pool.length, normalizeLimit(limit, pool.length))
 *
 *   empty pool                                   -> []
 *   a stored selection of exactly effectiveCount  -> restored, in stored
 *   valid/unique/pool-member ids exists              order (applies even
 *                                                     when effectiveCount
 *                                                     === pool.length --
 *                                                     small pools also get
 *                                                     stable reload order)
 *   otherwise                                     -> shuffle the full pool,
 *                                                     take the first
 *                                                     effectiveCount
 */
export function selectAttemptQuestions(pool, limit, storedIds, random = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return []

  const normalizedLimit = normalizeLimit(limit, pool.length)
  const effectiveCount = Math.min(pool.length, normalizedLimit)

  const restored = restoreStoredOrder(pool, storedIds, effectiveCount)
  if (restored) return restored

  return shuffleQuestions(pool, random).slice(0, effectiveCount)
}

// ── sessionStorage persistence ──────────────────────────────────────────────
//
// Kept separate from the pure functions above: every operation here is
// wrapped defensively so a storage failure (quota, privacy mode, corrupted
// JSON, sessionStorage unavailable) never escapes into the loading screen --
// it just behaves as if nothing was stored. `globalThis.sessionStorage` is
// read fresh on every call (not cached) so tests can inject a mock without
// import-order concerns.

function storageKey(testId) {
  return `mock_attempt_selection_${testId}`
}

export function readStoredSelection(testId) {
  try {
    const raw = globalThis.sessionStorage.getItem(storageKey(testId))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeStoredSelection(testId, questionIds) {
  try {
    globalThis.sessionStorage.setItem(
      storageKey(testId),
      JSON.stringify({ version: STORAGE_VERSION, testId, questionIds })
    )
  } catch {
    // Best-effort only -- a failed write must never block loading.
  }
}

export function clearStoredSelection(testId) {
  try {
    globalThis.sessionStorage.removeItem(storageKey(testId))
  } catch {
    // Best-effort only.
  }
}

/**
 * Validate a raw (already-parsed-or-null) stored payload against the current
 * test/pool. Returns the stored questionIds array only when every condition
 * holds; otherwise null, so the caller falls back to a fresh selection.
 * Never throws.
 */
export function validateStoredSelectionPayload(payload, testId, pool, limit) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (payload.version !== STORAGE_VERSION) return null
  if (payload.testId !== testId) return null
  if (!Array.isArray(payload.questionIds)) return null

  const normalizedLimit = normalizeLimit(limit, pool.length)
  const effectiveCount = Math.min(pool.length, normalizedLimit)
  if (payload.questionIds.length !== effectiveCount) return null

  const poolIds = new Set(pool.map(q => q.id))
  const seen = new Set()
  for (const id of payload.questionIds) {
    if (typeof id !== 'string' || id.length === 0) return null
    if (seen.has(id)) return null
    seen.add(id)
    if (!poolIds.has(id)) return null
  }

  return payload.questionIds
}
