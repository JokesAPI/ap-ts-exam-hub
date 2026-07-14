/**
 * Tests for api/groq-chat.js (Phase 4.2: auth, validation, rate limiting).
 * Run: node --experimental-test-module-mocks tests/groq-chat.test.mjs
 *
 * Supabase is mocked (auth.getUser + rpc). The real HMAC/DB logic for payments
 * is untouched and covered by its own test files.
 */
import assert from 'assert';
import { mock } from 'node:test';

process.env.SUPABASE_URL = 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';
process.env.GROQ_API_KEY = 'gsk_stub';

let scenario = {};
const VALID_USER = { id: 'user-123' };

const supabaseStub = {
  auth: {
    getUser: async (token) => {
      if (scenario.authError) return { data: null, error: { message: 'invalid token' } };
      if (token === 'valid-token') return { data: { user: VALID_USER }, error: null };
      return { data: { user: null }, error: { message: 'invalid token' } };
    },
  },
  rpc: async (fn, args) => {
    if (fn !== 'check_and_increment_ai_rate_limit') throw new Error('unexpected rpc: ' + fn);
    if (scenario.rateLimitDbError) return { data: null, error: { message: 'db error' } };
    return { data: scenario.rateLimitResult ?? { allowed: true, remaining: 19, limit: 20, retry_after_seconds: 0 }, error: null };
  },
};

mock.module('@supabase/supabase-js', { namedExports: { createClient: () => supabaseStub } });

// Stub the Groq fetch call
globalThis.fetch = async (url) => {
  if (String(url).includes('api.groq.com')) {
    if (scenario.groqError) return { ok: false, status: 503, json: async () => ({ error: { message: 'upstream detail should never leak' } }) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Hello from AI' } }] }) };
  }
  throw new Error('unexpected fetch: ' + url);
};

const { default: handler } = await import('../api/groq-chat.js');

function mockRes() {
  const r = { statusCode: null, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}

async function call(body, headers = {}, sc = {}) {
  scenario = sc;
  const res = mockRes();
  await handler({ method: 'POST', headers, body }, res);
  return res;
}

const validMsgs = [{ role: 'user', content: 'Hello' }];
const authHeader = { authorization: 'Bearer valid-token' };

const tests = [];
const test = (n, f) => tests.push({ n, f });

test('1. missing Authorization header -> 401, unified login message', async () => {
  const res = await call({ messages: validMsgs }, {});
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, 'Please log in to use AI features.');
});

test('2. invalid/expired token -> 401, unified login message (not "Authentication required")', async () => {
  const res = await call({ messages: validMsgs }, { authorization: 'Bearer bad-token' });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.error, 'Please log in to use AI features.');
});

test('2b. "Authentication required" must never appear in any response body', async () => {
  const r1 = await call({ messages: validMsgs }, {});
  const r2 = await call({ messages: validMsgs }, { authorization: 'Bearer bad-token' });
  assert.ok(!JSON.stringify(r1.body).includes('Authentication required'));
  assert.ok(!JSON.stringify(r2.body).includes('Authentication required'));
});

test('3. missing messages array -> 400 Invalid request body', async () => {
  const res = await call({}, authHeader);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'Invalid request body');
});

test('4. empty messages array -> 400', async () => {
  const res = await call({ messages: [] }, authHeader);
  assert.strictEqual(res.statusCode, 400);
});

test('5. malformed message (bad role) -> 400 Invalid request body', async () => {
  const res = await call({ messages: [{ role: 'hacker', content: 'x' }] }, authHeader);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'Invalid request body');
});

test('6. empty prompt (whitespace only) -> 400 Prompt cannot be empty', async () => {
  const res = await call({ messages: [{ role: 'user', content: '   ' }] }, authHeader);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'Prompt cannot be empty');
});

test('7. prompt over 4000 chars -> 400 Prompt too long', async () => {
  const res = await call({ messages: [{ role: 'user', content: 'a'.repeat(4001) }] }, authHeader);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /too long/);
});

test('8. prompt exactly 4000 chars -> allowed', async () => {
  const res = await call({ messages: [{ role: 'user', content: 'a'.repeat(4000) }] }, authHeader);
  assert.strictEqual(res.statusCode, 200);
});

test('9. valid authenticated request -> 200 with reply, remaining, and reset_at', async () => {
  const res = await call({ messages: validMsgs }, authHeader, {
    rateLimitResult: { allowed: true, remaining: 17, limit: 20, retry_after_seconds: 0 },
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.reply, 'Hello from AI');
  assert.strictEqual(res.body.remaining, 17);
  assert.ok(typeof res.body.reset_at === 'string' && !isNaN(Date.parse(res.body.reset_at)), 'reset_at must be a valid ISO timestamp');
});

test('10. rate limit exceeded -> 429 with remaining and reset_at', async () => {
  const res = await call({ messages: validMsgs }, authHeader, {
    rateLimitResult: { allowed: false, remaining: 0, limit: 20, retry_after_seconds: 1800 },
  });
  assert.strictEqual(res.statusCode, 429);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error, 'Rate limit exceeded');
  assert.strictEqual(res.body.remaining, 0);
  assert.ok(typeof res.body.reset_at === 'string' && !isNaN(Date.parse(res.body.reset_at)), 'reset_at must be a valid ISO timestamp');
});

test('11. rate-limit RPC failure -> 500, generic message (no DB error leaked)', async () => {
  const res = await call({ messages: validMsgs }, authHeader, { rateLimitDbError: true });
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.error, 'Server error');
});

test('12. Groq upstream failure -> generic message, no upstream detail leaked', async () => {
  const res = await call({ messages: validMsgs }, authHeader, { groqError: true });
  assert.strictEqual(res.statusCode, 502);
  assert.strictEqual(res.body.error, 'AI service is temporarily unavailable');
  assert.ok(!JSON.stringify(res.body).includes('upstream detail'), 'must not leak upstream error text');
});

test('13. missing GROQ_API_KEY -> 500 generic, no secret name leaked to client', async () => {
  delete process.env.GROQ_API_KEY;
  const res = await call({ messages: validMsgs }, authHeader);
  process.env.GROQ_API_KEY = 'gsk_stub';
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.error, 'Server configuration error');
});

test('14. response never contains the word "GROQ_API_KEY" or a stack trace', async () => {
  const res = await call({ messages: validMsgs }, authHeader);
  const s = JSON.stringify(res.body);
  assert.ok(!s.includes('GROQ_API_KEY'));
  assert.ok(!s.includes('at handler'));
});

let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.f(); console.log(`  PASS  ${t.n}`); passed++; }
  catch (e) { console.log(`  FAIL  ${t.n}\n        ${e.message}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
