/**
 * Tests for api/verify-payment.js
 *
 * Run:  node tests/verify-payment.test.mjs
 *
 * No test framework dependency — plain Node, so it runs anywhere (CI, local,
 * Vercel build) without adding packages to a production app.
 *
 * Supabase and the environment are stubbed. Razorpay signatures are computed
 * with the real HMAC so signature verification is exercised for real, not faked.
 */
import crypto from 'crypto';
import assert from 'assert';

const SECRET = 'test_razorpay_secret';
const USER   = '11111111-1111-1111-1111-111111111111';

process.env.RAZORPAY_KEY_SECRET      = SECRET;
process.env.RAZORPAY_KEY_ID          = 'rzp_test_key';
process.env.SUPABASE_URL             = 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';

// ── Razorpay Fetch-Payment API stub ──────────────────────────────────────────
// scenario.rzpPayment defines what Razorpay "really" captured. This is the new
// authoritative check: the browser can lie, Razorpay cannot.
globalThis.fetch = async (url) => {
  if (String(url).includes('api.razorpay.com/v1/payments/')) {
    if (scenario.rzpHttpError) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => scenario.rzpPayment };
  }
  throw new Error('unexpected fetch: ' + url);
};

// ── Supabase stub ────────────────────────────────────────────────────────────
// Behaviour is driven by `scenario`, letting each test force a specific DB result.
let scenario = {};

const supabaseStub = {
  from(table) {
    const ctx = { table, _filters: {} };

    ctx.insert = () => ({
      // insert(...) is awaited directly in the handler
      then: (resolve) => resolve({ error: scenario.insertError ?? null }),
    });

    ctx.select = () => ctx;
    ctx.update = (payload) => { ctx._payload = payload; return ctx; };
    ctx.eq = (col, val) => { ctx._filters[col] = val; return ctx; };

    ctx.maybeSingle = async () => {
      if (ctx.table === 'payments')  return scenario.existingPayment ?? { data: null, error: null };
      if (ctx.table === 'profiles')  return scenario.existingProfile ?? { data: null, error: null };
      return { data: null, error: null };
    };

    // update(...).eq(...).select(...) is awaited → thenable
    ctx.then = (resolve) => {
      if (ctx._payload) {
        // This is the profiles UPDATE
        if (scenario.updateError) return resolve({ data: null, error: scenario.updateError });
        return resolve({ data: scenario.updatedRows ?? [], error: null });
      }
      return resolve({ data: null, error: null });
    };

    return ctx;
  },
};

// Mock @supabase/supabase-js for ESM (Node >=22, --experimental-test-module-mocks).
// The production handler is NOT modified — no test hooks in shipped code.
import { mock } from 'node:test';
mock.module('@supabase/supabase-js', {
  namedExports: { createClient: () => supabaseStub },
});

const { default: handler } = await import('../api/verify-payment.js');

// ── Helpers ──────────────────────────────────────────────────────────────────
const sign = (orderId, paymentId) =>
  crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

function mockRes() {
  const r = { statusCode: null, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}

async function call(body, sc = {}) {
  // default to a genuine captured Rs.9 payment unless a test overrides it
  scenario = { rzpPayment: goodRzp(body.razorpay_payment_id), ...sc };
  const res = mockRes();
  await handler({ method: 'POST', body }, res);
  return res;
}

// What Razorpay reports for a genuine, captured Rs.9 monthly payment.
const goodRzp = (paymentId = 'pay_TEST1', over = {}) => ({
  id: paymentId, entity: 'payment', amount: 900, currency: 'INR',
  status: 'captured', captured: true, order_id: 'order_TEST1', ...over,
});

const validBody = (plan = 'monthly', paymentId = 'pay_TEST1') => ({
  razorpay_order_id:   'order_TEST1',
  razorpay_payment_id: paymentId,
  razorpay_signature:  sign('order_TEST1', paymentId),
  user_id:             USER,
  plan,
});

const activatedRow = (months) => {
  const d = new Date(); d.setMonth(d.getMonth() + months);
  return [{ id: USER, is_pro: true, pro_expires_at: d.toISOString() }];
};

// ── Tests ────────────────────────────────────────────────────────────────────
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// 1. Valid payment verification (monthly)  [also test 8]
test('1/8. valid monthly payment activates Pro', async () => {
  const res = await call(validBody('monthly'), { updatedRows: activatedRow(1) });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.expires_at, 'expires_at must be echoed from the DB');
});

// TEST BUILD: yearly is DISABLED so nobody can get 12 months for Rs.9
test('S1. yearly plan is REJECTED during the Rs.9 test (no 12 months for Rs.9)', async () => {
  const res = await call(validBody('yearly'), { updatedRows: activatedRow(12) });
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /Invalid plan/);
});

// ── Razorpay authoritative-amount checks (the new security layer) ────────────
test('S2. captured amount Rs.9 (900 paise) -> success', async () => {
  const res = await call(validBody(), {
    rzpPayment: goodRzp('pay_TEST1', { amount: 900 }),
    updatedRows: activatedRow(1),
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
});

test('S3. captured amount Re.1 (100 paise) -> REJECTED, no activation', async () => {
  const res = await call(validBody(), {
    rzpPayment: goodRzp('pay_TEST1', { amount: 100 }),   // paid Re.1
    updatedRows: activatedRow(1),                         // would have activated
  });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

test('S4. payment NOT captured (authorized) -> REJECTED', async () => {
  const res = await call(validBody(), {
    rzpPayment: goodRzp('pay_TEST1', { status: 'authorized', captured: false }),
    updatedRows: activatedRow(1),
  });
  assert.strictEqual(res.statusCode, 400);
});

test('S5. wrong currency (USD) -> REJECTED', async () => {
  const res = await call(validBody(), {
    rzpPayment: goodRzp('pay_TEST1', { currency: 'USD' }),
    updatedRows: activatedRow(1),
  });
  assert.strictEqual(res.statusCode, 400);
});

test('S6. order_id mismatch -> REJECTED', async () => {
  const res = await call(validBody(), {
    rzpPayment: goodRzp('pay_TEST1', { order_id: 'order_SOMEONE_ELSE' }),
    updatedRows: activatedRow(1),
  });
  assert.strictEqual(res.statusCode, 400);
});

test('S7. payment does not exist at Razorpay (404) -> REJECTED', async () => {
  const res = await call(validBody(), { rzpHttpError: true, updatedRows: activatedRow(1) });
  assert.strictEqual(res.statusCode, 400);
});

// 2. Invalid signature
test('2. invalid signature is rejected (400) and never activates', async () => {
  const body = { ...validBody(), razorpay_signature: 'deadbeef' };
  const res = await call(body, { updatedRows: activatedRow(1) });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

// 3. Missing required field
test('3. missing required field is rejected (400)', async () => {
  const body = validBody();
  delete body.razorpay_signature;
  const res = await call(body);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /Missing required fields/);
});

// 3b. Unknown plan (requirement D)
test('3b. unknown plan is rejected (400)', async () => {
  const res = await call(validBody('lifetime_free_hack'));
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /Invalid plan/);
});

// 4. Nonexistent user_id → zero-row update MUST NOT be reported as success
test('4. nonexistent user_id (zero rows updated) fails, not success', async () => {
  const res = await call(validBody(), { updatedRows: [] });   // no error, zero rows
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error, /Failed to activate Pro/);
});

// 5. Profile update database error
test('5. profile update DB error returns 500', async () => {
  const res = await call(validBody(), {
    updateError: { code: '42703', message: 'column "updated_at" does not exist' },
  });
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.success, false);
});

// 5b. Regression: activation must not be claimed if is_pro did not persist
test('5b. row returned but is_pro=false is treated as failure', async () => {
  const res = await call(validBody(), {
    updatedRows: [{ id: USER, is_pro: false, pro_expires_at: null }],
  });
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.success, false);
});

// 6. Payment insert error (non-duplicate) must NOT be hidden
test('6. payment insert error is fatal (500), not swallowed', async () => {
  const res = await call(validBody(), {
    insertError: { code: '08006', message: 'connection failure' },
    updatedRows: activatedRow(1),
  });
  assert.strictEqual(res.statusCode, 500);
  assert.match(res.body.error, /Could not record payment/);
});

// 7a. Duplicate payment id, same user, already active → no re-extension
test('7a. duplicate payment (already active) returns success WITHOUT extending', async () => {
  const existingExpiry = new Date(Date.now() + 20 * 86400000).toISOString();
  const res = await call(validBody(), {
    insertError: { code: '23505', message: 'duplicate key' },
    existingPayment: { data: { user_id: USER }, error: null },
    existingProfile: { data: { is_pro: true, pro_expires_at: existingExpiry }, error: null },
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.already_processed, true);
  assert.strictEqual(res.body.expires_at, existingExpiry, 'expiry must NOT be extended on replay');
});

// 7b. Duplicate payment id belonging to a DIFFERENT user → rejected
test('7b. replayed payment id for another user is rejected (409)', async () => {
  const res = await call(validBody(), {
    insertError: { code: '23505', message: 'duplicate key' },
    existingPayment: { data: { user_id: '99999999-9999-9999-9999-999999999999' }, error: null },
  });
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.success, false);
});

// 7c. Recovery: payment recorded previously but activation never completed
test('7c. duplicate payment with inactive profile re-activates (recovery)', async () => {
  const res = await call(validBody(), {
    insertError: { code: '23505', message: 'duplicate key' },
    existingPayment: { data: { user_id: USER }, error: null },
    existingProfile: { data: { is_pro: false, pro_expires_at: null }, error: null },
    updatedRows: activatedRow(1),
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
});

// ── Runner ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`  PASS  ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${t.name}\n        ${e.message}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
