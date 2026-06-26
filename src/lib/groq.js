const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export async function callGroq(systemPrompt, messages) {
  if (!SUPABASE_URL) throw new Error('Supabase URL not configured')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/groq-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      system:   systemPrompt,
      messages: messages.filter(m => m.role !== 'system'),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Groq error: ${res.status}`)
  }

  const data = await res.json()
  if (!data.reply) throw new Error('Empty response from AI')
  return data.reply
}