// Regression check for src/pages/admin/AdminExams.jsx `save()`.
//
// No component/DOM framework exists in this repo (see SETUP.md / package.json),
// so this mirrors the pattern already used by tests/verify-payment.test.mjs and
// tests/create-order.test.mjs: exercise the exact function body in isolation
// with mocked collaborators (setState fns, toast, supabase), using node's
// built-in test runner.
//
// Regression target: Phase 6.5C.1 introduced an ASI hazard --
//   const insertPayload = { ...payload, exam_name, slug }
//   ({ error: err } = await supabase.from('exams').insert([insertPayload]))
// With no semicolon terminating the object-literal statement, JS parses the
// following `(...)` as a call on that object literal, forcing `insertPayload`
// to be read as part of evaluating its own initializer -> TDZ ReferenceError.
// The Save button froze on "Saving..." because the throw escaped save()
// before `setSaving(false)` on line 45 ever ran.

import test from 'node:test'
import assert from 'node:assert/strict'

// ── exact body of save(), copied from src/pages/admin/AdminExams.jsx ──────
function makeSave({ setSaving, setModal, load, toast }) {
  return async function save(form, editing, supabase) {
    setSaving(true)
    if (!form.title.trim()) { toast.error('Title is required'); setSaving(false); return }
    const payload = { ...form, exam_date: form.exam_date || null, last_date: form.last_date || null }
    let err
    if (editing) {
      ({ error: err } = await supabase.from('exams').update(payload).eq('id', editing))
    } else {
      const slug = form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const insertPayload = { ...payload, exam_name: form.title.trim(), slug };
      ({ error: err } = await supabase.from('exams').insert([insertPayload]))
    }
    setSaving(false)
    if (err) { toast.error(err.message); return }
    toast.success(editing ? 'Updated!' : 'Added!')
    setModal(false)
    load()
  }
}
// ────────────────────────────────────────────────────────────────────────

function harness() {
  const state = { saving: null, modal: null, toasts: [], inserts: [], updates: [] }
  const setSaving = v => { state.saving = v }
  const setModal = v => { state.modal = v }
  const load = () => {}
  const toast = {
    error: m => state.toasts.push(['error', m]),
    success: m => state.toasts.push(['success', m]),
  }
  const supabase = {
    from: table => ({
      update(payload) {
        state.updates.push({ table, payload })
        return { eq: () => Promise.resolve({ error: null }) }
      },
      insert(rows) {
        state.inserts.push({ table, rows })
        return Promise.resolve({ error: null })
      },
    }),
  }
  const supabaseFailing = {
    from: table => ({
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'mock update error' } }) }),
      insert: () => Promise.resolve({ error: { message: 'mock insert error' } }),
    }),
  }
  return { state, save: makeSave({ setSaving, setModal, load, toast }), supabase, supabaseFailing }
}

const smokeForm = {
  title: 'TEST EXAM DELETE ME',
  organization: 'Other',
  description: 'Temporary production smoke test',
  exam_date: '', last_date: '', status: 'Upcoming', notification_url: '',
}

test('create: does not throw and reaches the insert call', async () => {
  const { state, save, supabase } = harness()
  await assert.doesNotReject(() => save(smokeForm, null, supabase))
  assert.equal(state.inserts.length, 1, 'insert() must be called exactly once')
})

test('create: exam_name and slug are populated on the inserted row', async () => {
  const { state, save, supabase } = harness()
  await save(smokeForm, null, supabase)
  const row = state.inserts[0].rows[0]
  assert.equal(row.exam_name, 'TEST EXAM DELETE ME')
  assert.equal(row.slug, 'test-exam-delete-me')
  assert.equal(row.title, 'TEST EXAM DELETE ME')
})

test('create: saving state resets to false on success', async () => {
  const { state, save, supabase } = harness()
  await save(smokeForm, null, supabase)
  assert.equal(state.saving, false)
})

test('create: saving state resets to false on server-side failure (no stuck button)', async () => {
  const { state, save, supabaseFailing } = harness()
  await save(smokeForm, null, supabaseFailing)
  assert.equal(state.saving, false)
  assert.deepEqual(state.toasts, [['error', 'mock insert error']])
})

test('edit: update payload is unchanged (no exam_name/slug injected)', async () => {
  const { state, save, supabase } = harness()
  await save(smokeForm, 'some-uuid', supabase)
  assert.equal(state.updates.length, 1)
  assert.ok(!('exam_name' in state.updates[0].payload))
  assert.ok(!('slug' in state.updates[0].payload))
  assert.equal(state.saving, false)
})

test('validation: empty title never reaches supabase', async () => {
  const { state, save, supabase } = harness()
  await save({ ...smokeForm, title: '   ' }, null, supabase)
  assert.equal(state.inserts.length, 0)
  assert.equal(state.updates.length, 0)
  assert.equal(state.saving, false)
})
