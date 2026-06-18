export async function callGroq(systemPrompt, messages) {
  const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY

  if (!GROQ_KEY) {
    return 'Groq API key not configured. Please add VITE_GROQ_API_KEY to your .env file.'
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    console.error('Groq error:', err)
    throw new Error(err?.error?.message || 'Groq API error')
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response from AI.'
}
