// Provider-neutral AI helper. The frontend only knows callAI(); the actual
// provider (OpenAI) lives server-side in /api/groq-chat. Request/response
// contract is unchanged: send { system, messages }, receive { reply }.
export async function callAI(systemPrompt, messages) {
  const res = await fetch('/api/groq-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system:   systemPrompt,
      messages: messages.filter(m => m.role !== 'system'),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `AI error: ${res.status}`)
  }

  const data = await res.json()
  if (!data.reply) throw new Error('Empty response from AI')
  return data.reply
}
