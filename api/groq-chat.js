import { createClient } from '@supabase/supabase-js';

const MAX_PROMPT_LENGTH = 4000;
const MAX_MESSAGES_IN_HISTORY = 10;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // ── 1. Require an authenticated user ──────────────────────────────────────
    // The AI endpoint was previously fully anonymous and CORS('*') — anyone on
    // the internet could POST here and consume Groq credits with no account.
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Please log in to use AI features.' });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('groq-chat: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ success: false, error: 'Please log in to use AI features.' });
    }

    // ── 2. Validate the request body ────────────────────────────────────────
    const { messages, system } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }
    if (system !== undefined && typeof system !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }
    // Every message must have a valid role/content shape.
    const validRole = r => r === 'user' || r === 'assistant' || r === 'system';
    if (!messages.every(m => m && validRole(m.role) && typeof m.content === 'string')) {
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }

    // The "prompt" is the latest user turn — what the student actually typed.
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const prompt = (lastUserMessage?.content || '').trim();
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt cannot be empty' });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ success: false, error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
    }

    // ── 3. Rate limiting — 20 requests/hour/user, enforced atomically in Postgres ──
    // A new Supabase table + one SECURITY DEFINER RPC (Phase 4.2 / Option A):
    // supabase/migrations/20260714035048_phase4_2_ai_rate_limit.sql.
    // The check-and-increment is a single atomic statement, so it is race-safe
    // across concurrent serverless invocations (unlike an in-memory counter,
    // which would not survive cold starts or multiple instances).
    const { data: rateData, error: rateError } = await supabase.rpc(
      'check_and_increment_ai_rate_limit',
      { p_user_id: userData.user.id, p_max_per_hour: 20 }
    );
    if (rateError) {
      console.error('groq-chat: rate-limit check failed:', rateError);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
    // "reset_at" is the start of the next UTC hour window — this mirrors the
    // RPC's own date_trunc('hour', now()) bucketing without a second DB round
    // trip or any change to the migration/RPC.
    const resetAt = (() => {
      const d = new Date();
      d.setUTCMinutes(0, 0, 0);
      d.setUTCHours(d.getUTCHours() + 1);
      return d.toISOString();
    })();

    if (!rateData?.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        remaining: 0,
        reset_at: resetAt,
      });
    }

    // ── 4. Call Groq (key stays server-side; never echoed to the client) ─────
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.error('groq-chat: GROQ_API_KEY not set');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages.slice(-MAX_MESSAGES_IN_HISTORY),
        ],
      }),
    });

    if (!groqRes.ok) {
      // Log the real reason server-side only; never forward upstream details
      // (which could include provider-internal messages) to the client.
      const errBody = await groqRes.json().catch(() => ({}));
      console.error('groq-chat: Groq API error', groqRes.status, errBody);
      return res.status(502).json({ success: false, error: 'AI service is temporarily unavailable' });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({ success: true, reply, remaining: rateData.remaining, reset_at: resetAt });

  } catch (err) {
    // Generic message to the client; full detail only in server logs.
    console.error('groq-chat error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
