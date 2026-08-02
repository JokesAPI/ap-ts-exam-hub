// Regression tests for src/pages/admin/AdminMockTests.jsx -- aggregation
// logic and the activate()/deactivate() write path.
//
// No component/DOM framework exists in this repo (see
// tests/admin-exams-save.test.mjs), so this mirrors that file's pattern:
// copy the exact function bodies out of the component and exercise them in
// isolation with mocked collaborators (state setters, toast, confirm,
// supabase), using node's built-in test runner.

import test from 'node:test'
import assert from 'node:assert/strict'

// ── exact aggregation body, copied from AdminMockTests.jsx's load() ────────
function aggregateCounts(qRows) {
  const agg = {}
  for (const row of qRows || []) {
    const tid = row.test_id
    if (!agg[tid]) agg[tid] = { total: 0, published: 0, draft: 0, other: 0 }
    agg[tid].total += 1
    if (row.status === 'published') agg[tid].published += 1
    else if (row.status === 'draft') agg[tid].draft += 1
    else agg[tid].other += 1
  }
  return agg
}

// ── exact body of resolveLoadResult(), copied from AdminMockTests.jsx ──────
// This is load()'s entire decision logic: given the two raw query results,
// decide fail-closed (preserve existing state, report an error) vs. success
// (replace tests/counts). load() itself does nothing but call this and
// apply the result -- see the component for the exact call site.
function resolveLoadResult({ testRows, testsErr, qRows, qErr }) {
  if (testsErr || qErr) {
    return { ok: false, error: testsErr?.message || qErr?.message || 'Failed to load mock tests.' }
  }

  const agg = {}
  for (const row of qRows || []) {
    const tid = row.test_id
    if (!agg[tid]) agg[tid] = { total: 0, published: 0, draft: 0, other: 0 }
    agg[tid].total += 1
    if (row.status === 'published') agg[tid].published += 1
    else if (row.status === 'draft') agg[tid].draft += 1
    else agg[tid].other += 1
  }

  return { ok: true, tests: testRows || [], counts: agg }
}

function getCounts(counts, testId) {
  return counts[testId] || { total: 0, published: 0, draft: 0, other: 0 }
}

// ── exact body of setActive(), copied from AdminMockTests.jsx ──────────────
function makeSetActive({ getSavingId, setSavingId, setTests, toast, confirmFn }) {
  return async function setActive(test, nextActive, counts, supabase) {
    if (getSavingId()) return

    const c = getCounts(counts, test.test_id)

    if (nextActive && c.published === 0) {
      toast.error('Cannot activate: 0 published questions')
      return
    }

    const verb = nextActive ? 'Activate' : 'Deactivate'
    const confirmed = confirmFn(
      `${verb} "${test.title}" (${test.test_id})?\n\n` +
      `Published: ${c.published}\nDraft: ${c.draft}\n\n` +
      (nextActive
        ? 'This will make the test visible to students on the public catalogue.'
        : 'This will immediately hide the test from the public catalogue.')
    )
    if (!confirmed) return

    setSavingId(test.test_id)
    try {
      const { error: updateErr } = await supabase
        .from('mock_tests')
        .update({ is_active: nextActive })
        .eq('test_id', test.test_id)

      if (updateErr) {
        toast.error(updateErr.message)
        return
      }

      const { data: fresh, error: refetchErr } = await supabase
        .from('mock_tests')
        .select('*')
        .eq('test_id', test.test_id)
        .maybeSingle()

      if (refetchErr || !fresh || fresh.is_active !== nextActive) {
        toast.error('Update could not be verified -- please refresh and check manually.')
        return
      }

      setTests(fresh)
      toast.success(`${fresh.title} is now ${nextActive ? 'active' : 'inactive'}`)
    } finally {
      setSavingId(null)
    }
  }
}
// ────────────────────────────────────────────────────────────────────────

function makeMockSupabase({ updateResult = { error: null }, refetchResult = { data: null, error: null } } = {}) {
  const calls = []
  const client = {
    from(table) {
      return {
        update(payload) {
          calls.push({ table, method: 'update', payload })
          return {
            eq(col, val) {
              calls.push({ table, method: 'update.eq', col, val })
              return Promise.resolve(updateResult)
            },
          }
        },
        select(cols) {
          calls.push({ table, method: 'select', cols })
          return {
            eq(col, val) {
              calls.push({ table, method: 'select.eq', col, val })
              return {
                maybeSingle() {
                  calls.push({ table, method: 'maybeSingle' })
                  return Promise.resolve(refetchResult)
                },
              }
            },
          }
        },
        insert(rows) {
          calls.push({ table, method: 'insert', rows })
          return Promise.resolve({ error: null })
        },
        delete() {
          calls.push({ table, method: 'delete' })
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    },
  }
  return { calls, client }
}

function harness(supabaseOpts) {
  const { calls, client } = makeMockSupabase(supabaseOpts)
  const state = { savingId: null, toasts: [], confirmCalls: [], confirmReturn: true, freshRow: null }
  const toast = {
    error: m => state.toasts.push(['error', m]),
    success: m => state.toasts.push(['success', m]),
  }
  const confirmFn = msg => { state.confirmCalls.push(msg); return state.confirmReturn }
  const setActive = makeSetActive({
    getSavingId: () => state.savingId,
    setSavingId: v => { state.savingId = v },
    setTests: fresh => { state.freshRow = fresh },
    toast,
    confirmFn,
  })
  return { calls, client, state, setActive }
}

const testRow = { test_id: 'indian-geography', title: 'Indian Geography', is_active: false }

// ── Loading and aggregation ─────────────────────────────────────────────────

test('aggregation: counts are grouped correctly by test_id', () => {
  const rows = [
    { test_id: 'a', status: 'published' },
    { test_id: 'a', status: 'draft' },
    { test_id: 'b', status: 'published' },
  ]
  const agg = aggregateCounts(rows)
  assert.equal(agg.a.total, 2)
  assert.equal(agg.b.total, 1)
})

test('aggregation: published and draft counts are correct', () => {
  const rows = [
    { test_id: 'indian-geography', status: 'published' },
    { test_id: 'indian-geography', status: 'published' },
    { test_id: 'indian-geography', status: 'draft' },
  ]
  const agg = aggregateCounts(rows)
  assert.equal(agg['indian-geography'].published, 2)
  assert.equal(agg['indian-geography'].draft, 1)
  assert.equal(agg['indian-geography'].total, 3)
})

test('aggregation: a test with no questions shows zero counts via getCounts fallback', () => {
  const agg = aggregateCounts([{ test_id: 'other-test', status: 'published' }])
  const c = getCounts(agg, 'indian-geography')
  assert.deepEqual(c, { total: 0, published: 0, draft: 0, other: 0 })
})

test('aggregation: unexpected statuses count toward total but not published/draft', () => {
  const rows = [
    { test_id: 'x', status: 'rejected' },
    { test_id: 'x', status: 'in_review' },
    { test_id: 'x', status: 'published' },
  ]
  const agg = aggregateCounts(rows)
  assert.equal(agg.x.total, 3)
  assert.equal(agg.x.published, 1)
  assert.equal(agg.x.draft, 0)
  assert.equal(agg.x.other, 2)
})

// ── load() fail-closed behavior ─────────────────────────────────────────────

// ── exact body of load(), copied from AdminMockTests.jsx ───────────────────
// (minus the useCallback wrapper, which is a React-only concern -- the async
// body itself, including the call to resolveLoadResult(), is unmodified.)
function makeLoad({ setLoading, setError, setTests, setCounts }) {
  return async function load(supabase) {
    setLoading(true)
    setError('')

    const [{ data: testRows, error: testsErr }, { data: qRows, error: qErr }] = await Promise.all([
      supabase.from('mock_tests').select('*').order('display_order', { ascending: true }),
      supabase.from('mock_questions').select('test_id, status'),
    ])

    const result = resolveLoadResult({ testRows, testsErr, qRows, qErr })

    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    setTests(result.tests)
    setCounts(result.counts)
    setLoading(false)
  }
}

function makeLoadSupabase({ testsResult, questionsResult }) {
  return {
    from(table) {
      if (table === 'mock_tests') {
        return { select: () => ({ order: () => Promise.resolve(testsResult) }) }
      }
      if (table === 'mock_questions') {
        return { select: () => Promise.resolve(questionsResult) }
      }
      throw new Error(`Unexpected table in load() mock: ${table}`)
    },
  }
}

function loadHarness() {
  const state = { loading: null, error: null, tests: null, counts: null }
  const load = makeLoad({
    setLoading: v => { state.loading = v },
    setError: v => { state.error = v },
    setTests: v => { state.tests = v },
    setCounts: v => { state.counts = v },
  })
  return { state, load }
}

test('load(): mock_tests query failure preserves existing tests/counts, sets a useful error, resets loading', async () => {
  const { state, load } = loadHarness()
  const existingTests = [{ test_id: 'existing', title: 'Existing Test' }]
  const existingCounts = { existing: { total: 5, published: 5, draft: 0, other: 0 } }
  state.tests = existingTests
  state.counts = existingCounts

  const supabase = makeLoadSupabase({
    testsResult: { data: null, error: { message: 'mock_tests fetch failed' } },
    questionsResult: { data: [{ test_id: 'existing', status: 'published' }], error: null },
  })

  await load(supabase)

  assert.equal(state.error, 'mock_tests fetch failed')
  assert.strictEqual(state.tests, existingTests, 'tests must not be replaced on failure')
  assert.strictEqual(state.counts, existingCounts, 'counts must not be replaced on failure')
  assert.equal(state.loading, false, 'loading must reset even on failure')
})

test('load(): mock_questions query failure preserves existing tests/counts, sets a useful error, resets loading', async () => {
  const { state, load } = loadHarness()
  const existingTests = [{ test_id: 'existing', title: 'Existing Test' }]
  const existingCounts = { existing: { total: 5, published: 5, draft: 0, other: 0 } }
  state.tests = existingTests
  state.counts = existingCounts

  const supabase = makeLoadSupabase({
    testsResult: { data: [{ test_id: 'existing', title: 'Existing Test' }], error: null },
    questionsResult: { data: null, error: { message: 'mock_questions fetch failed' } },
  })

  await load(supabase)

  assert.equal(state.error, 'mock_questions fetch failed')
  assert.strictEqual(state.tests, existingTests, 'tests must not be replaced on failure')
  assert.strictEqual(state.counts, existingCounts, 'counts must not be replaced on failure')
  assert.equal(state.loading, false, 'loading must reset even on failure')
})

test('load(): a failure never renders a misleading empty/zero replacement -- state is untouched, not reset to [] or {}', async () => {
  const { state, load } = loadHarness()
  const existingTests = [{ test_id: 'existing', title: 'Existing Test' }]
  const existingCounts = { existing: { total: 5, published: 5, draft: 0, other: 0 } }
  state.tests = existingTests
  state.counts = existingCounts

  const supabase = makeLoadSupabase({
    testsResult: { data: null, error: { message: 'boom' } },
    questionsResult: { data: null, error: null },
  })

  await load(supabase)

  // Not just "still correct" -- literally the same reference, proving
  // setTests/setCounts were never called at all, not called with [] / {}.
  assert.strictEqual(state.tests, existingTests)
  assert.strictEqual(state.counts, existingCounts)
})

test('load(): a successful load replaces tests/counts with fresh values, clears any prior error, resets loading', async () => {
  const { state, load } = loadHarness()
  state.error = 'stale previous error'
  state.tests = [{ test_id: 'old', title: 'Old' }]
  state.counts = { old: { total: 1, published: 1, draft: 0, other: 0 } }

  const freshTests = [{ test_id: 'indian-geography', title: 'Indian Geography' }]
  const supabase = makeLoadSupabase({
    testsResult: { data: freshTests, error: null },
    questionsResult: { data: [{ test_id: 'indian-geography', status: 'published' }], error: null },
  })

  await load(supabase)

  assert.equal(state.error, '', 'a successful load must clear any prior error')
  assert.deepEqual(state.tests, freshTests)
  assert.deepEqual(state.counts, { 'indian-geography': { total: 1, published: 1, draft: 0, other: 0 } })
  assert.equal(state.loading, false)
})

// ── Activation ───────────────────────────────────────────────────────────────

test('activation: published=0 blocks update entirely', async () => {
  const { calls, client, state, setActive } = harness()
  const counts = { 'indian-geography': { total: 5, published: 0, draft: 5, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(calls.length, 0, 'no supabase call should be made')
  assert.equal(state.confirmCalls.length, 0, 'confirm should never be shown')
  assert.deepEqual(state.toasts, [['error', 'Cannot activate: 0 published questions']])
})

test('activation: published>0 shows the confirmation dialog with title, test_id, published and draft counts', async () => {
  const { client, state, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(state.confirmCalls.length, 1)
  const msg = state.confirmCalls[0]
  assert.match(msg, /Indian Geography/)
  assert.match(msg, /indian-geography/)
  assert.match(msg, /Published: 100/)
  assert.match(msg, /Draft: 0/)
})

test('activation: cancelled confirmation performs no update', async () => {
  const { calls, client, state, setActive } = harness()
  state.confirmReturn = false
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(calls.filter(c => c.method === 'update.eq').length, 0)
  assert.equal(state.toasts.length, 0)
})

test('activation: update payload contains only is_active: true', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  const updateCall = calls.find(c => c.method === 'update')
  assert.deepEqual(updateCall.payload, { is_active: true })
})

test('activation: exact test_id filter is used', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  const updateEqCall = calls.find(c => c.method === 'update.eq')
  assert.equal(updateEqCall.col, 'test_id')
  assert.equal(updateEqCall.val, 'indian-geography')
  const selectEqCall = calls.find(c => c.method === 'select.eq')
  assert.equal(selectEqCall.col, 'test_id')
  assert.equal(selectEqCall.val, 'indian-geography')
})

test('activation: double submission is blocked while a request is already running', async () => {
  const { calls, client, state, setActive } = harness()
  state.savingId = 'some-other-test' // simulate an in-flight request elsewhere
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(calls.length, 0)
  assert.equal(state.confirmCalls.length, 0)
})

test('activation: failed update resets saving state and shows an error', async () => {
  const { client, state, setActive } = harness({ updateResult: { error: { message: 'mock update error' } } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(state.savingId, null, 'saving state must reset even on failure')
  assert.deepEqual(state.toasts, [['error', 'mock update error']])
  assert.equal(state.freshRow, null, 'local state must not be updated on failure')
})

test('activation: successful update triggers a re-fetch of the same row', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.ok(calls.some(c => c.method === 'maybeSingle'), 're-fetch must occur after a successful update')
})

test('activation: a re-fetch mismatch (is_active still false) is treated as failure, not success', async () => {
  const { client, state, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(state.toasts[0][0], 'error')
  assert.equal(state.freshRow, null, 'a verification mismatch must not be reflected in local state')
  assert.equal(state.savingId, null)
})

test('activation: a re-fetch that returns an error is treated as failure, not success', async () => {
  const { client, state, setActive } = harness({ refetchResult: { data: null, error: { message: 'refetch failed' } } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(state.toasts[0][0], 'error')
  assert.equal(state.freshRow, null, 'a refetch error must not be reflected in local state')
  assert.equal(state.savingId, null, 'saving state must still reset')
})

test('activation: a re-fetch that returns no row (null fresh value, e.g. the row vanished) is treated as failure, not success', async () => {
  const { client, state, setActive } = harness({ refetchResult: { data: null, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(state.toasts[0][0], 'error')
  assert.equal(state.freshRow, null, 'a missing row must not be reflected in local state')
  assert.equal(state.savingId, null, 'saving state must still reset')
})

// ── Deactivation ─────────────────────────────────────────────────────────────

const activeTestRow = { test_id: 'indian-geography', title: 'Indian Geography', is_active: true }

test('deactivation: update payload contains only is_active: false', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...activeTestRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(activeTestRow, false, counts, client)
  const updateCall = calls.find(c => c.method === 'update')
  assert.deepEqual(updateCall.payload, { is_active: false })
})

test('deactivation: exact test_id filter is used', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...activeTestRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(activeTestRow, false, counts, client)
  const updateEqCall = calls.find(c => c.method === 'update.eq')
  assert.equal(updateEqCall.val, 'indian-geography')
})

test('deactivation: requires confirmation containing title and test_id', async () => {
  const { client, state, setActive } = harness({ refetchResult: { data: { ...activeTestRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(activeTestRow, false, counts, client)
  assert.equal(state.confirmCalls.length, 1)
  assert.match(state.confirmCalls[0], /Indian Geography/)
  assert.match(state.confirmCalls[0], /indian-geography/)
})

test('deactivation: does not require any published questions (unlike activation)', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...activeTestRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 0, published: 0, draft: 0, other: 0 } }
  await setActive(activeTestRow, false, counts, client)
  assert.ok(calls.some(c => c.method === 'update.eq'), 'deactivation must proceed even with zero published questions')
})

test('deactivation: success is verified by re-fetch before reporting success', async () => {
  const { client, state, setActive } = harness({ refetchResult: { data: { ...activeTestRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(activeTestRow, false, counts, client)
  assert.deepEqual(state.toasts, [['success', 'Indian Geography is now inactive']])
})

// ── Safety ───────────────────────────────────────────────────────────────────

test('safety: neither activation nor deactivation ever calls insert', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(calls.filter(c => c.method === 'insert').length, 0)
})

test('safety: neither activation nor deactivation ever calls delete', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...activeTestRow, is_active: false }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(activeTestRow, false, counts, client)
  assert.equal(calls.filter(c => c.method === 'delete').length, 0)
})

test('safety: the write path never touches the mock_questions table', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  assert.equal(calls.filter(c => c.table === 'mock_questions').length, 0)
  assert.ok(calls.every(c => c.table === 'mock_tests'))
})

test('safety: only the single targeted test_id is ever referenced -- no bulk action', async () => {
  const { calls, client, setActive } = harness({ refetchResult: { data: { ...testRow, is_active: true }, error: null } })
  const counts = { 'indian-geography': { total: 100, published: 100, draft: 0, other: 0 } }
  await setActive(testRow, true, counts, client)
  const eqCalls = calls.filter(c => c.method === 'update.eq' || c.method === 'select.eq')
  assert.ok(eqCalls.length > 0)
  assert.ok(eqCalls.every(c => c.val === 'indian-geography'))
})
