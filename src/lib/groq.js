export async function callGroq(systemPrompt, messages) {
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
    throw new Error(err.error || `Groq error: ${res.status}`)
  }

  const data = await res.json()
  if (!data.reply) throw new Error('Empty response from AI')
  return data.reply
}
