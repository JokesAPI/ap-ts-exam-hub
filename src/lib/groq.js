import { supabase } from './supabase'

export async function callGroq(systemPrompt, messages) {
  // The AI endpoint now requires authentication (Phase 4.2). Fail with a clear
  // client-side message rather than let an unauthenticated request reach the
  // server and get a generic 401 -- but the server enforces this independently
  // regardless of what the client sends.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Please log in to use AI features.')
  }

  const res = await fetch('/api/groq-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      system:   systemPrompt,
      messages: messages.filter(m => m.role !== 'system'),
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Groq error: ${res.status}`)
  }

  if (!data.reply) throw new Error('Empty response from AI')
  return data.reply
}
