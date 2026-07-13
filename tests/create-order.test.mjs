/**
 * Tests for api/create-order.js — the browser must NOT be able to choose the amount.
 * Run: node --experimental-test-module-mocks tests/create-order.test.mjs
 */
import assert from 'assert';

process.env.RAZORPAY_KEY_ID     = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';

let captured = null;   // what we actually sent to Razorpay
globalThis.fetch = async (url, opts) => {
  captured = JSON.parse(opts.body);
  return { ok: true, json: async () => ({ id: 'order_X', amount: captured.amount, currency: captured.currency }) };
};

const { default: handler } = await import('../api/create-order.js');

function mockRes() {
  const r = { statusCode: null, body: null };
  r.setHeader = () => {};
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
const call = async body => { captured = null; const res = mockRes(); await handler({ method: 'POST', body }, res); return res; };

const tests = [];
const test = (n, f) => tests.push({ n, f });

test('C1. browser sends amount=100 (Re.1) but plan=monthly -> server still creates 900 paise', async () => {
  const res = await call({ amount: 100, plan: 'monthly', user_id: 'u1' });   // hostile client
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(captured.amount, 900, 'server MUST ignore the browser amount');
  assert.strictEqual(captured.currency, 'INR');
  assert.strictEqual(res.body.amount, 900, 'response must echo the server amount');
});

test('C2. browser sends amount=1 crore -> still 900 paise', async () => {
  await call({ amount: 100000000, plan: 'monthly', user_id: 'u1' });
  assert.strictEqual(captured.amount, 900);
});

test('C3. yearly plan is rejected (disabled during the test)', async () => {
  const res = await call({ plan: 'yearly', user_id: 'u1' });
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /Invalid plan/);
});

test('C4. unknown plan is rejected', async () => {
  const res = await call({ plan: 'lifetime_free', user_id: 'u1' });
  assert.strictEqual(res.statusCode, 400);
});

test('C5. missing plan is rejected', async () => {
  const res = await call({ user_id: 'u1' });
  assert.strictEqual(res.statusCode, 400);
});

let p = 0, f = 0;
for (const t of tests) {
  try { await t.f(); console.log(`  PASS  ${t.n}`); p++; }
  catch (e) { console.log(`  FAIL  ${t.n}\n        ${e.message}`); f++; }
}
console.log(`\n${p} passed, ${f} failed`);
process.exit(f ? 1 : 0);
