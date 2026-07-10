// AI chat serverless endpoint (OpenAI Chat Completions).
// Route path kept as /api/groq-chat for backward compatibility with the
// existing frontend contract; internals use OpenAI. Request/response shape is
// unchanged: { system?, messages[] } in → { reply } out.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI not configured' });
    }

    const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 1500,
        temperature: 0.7,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages.slice(-10),
        ],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `AI error: ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('ai-chat error:', err);
    return res.status(500).json({ error: err.message });
  }
}
