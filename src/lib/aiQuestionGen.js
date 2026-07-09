// ── AI Question Generation (Phase 4) ─────────────────────────────────────────
// Reuses the existing server-side Groq backend (src/lib/groq.js → /api/groq-chat,
// key stays server-side). Generates competitive-exam MCQs as structured JSON and
// inserts them into ai_drafts as content_type='questions', status='draft'.
// NOTHING is published here — everything flows through the existing AdminDrafts
// review queue (validate → approve → publish).

import { callGroq } from './groq'
import { supabase } from './supabase'

const QUESTION_SYSTEM = `You are an expert question setter for Indian competitive government exams (APPSC, TGPSC, SSC, RRB, Banking, TG DSC, AP/TG Police, EAPCET).
Generate high-quality multiple-choice questions suitable for serious aspirants.
Rules:
- Each question has exactly 4 options and one unambiguous correct answer.
- Provide a clear, factual explanation (2-3 sentences).
- Assign difficulty honestly as "easy", "medium", or "hard".
- Never invent fake facts, dates, or figures. If unsure, choose a safer, well-established fact.
- Output ONLY valid JSON — an array of objects, no markdown, no preamble.
Each object must have exactly these keys:
question, option_a, option_b, option_c, option_d, correct_answer (one of "A","B","C","D"),
explanation, subject, topic, subtopic, difficulty, tags (array of strings).`

// Build the user prompt for a batch generation request.
export function buildQuestionPrompt({ count, exam, subject, topic, sourceText }) {
  const parts = [`Generate ${count} multiple-choice questions.`]
  if (exam)    parts.push(`Target exam: ${exam}.`)
  if (subject) parts.push(`Subject: ${subject}.`)
  if (topic)   parts.push(`Topic focus: ${topic}.`)
  if (sourceText) {
    parts.push(`Base the questions on the following current-affairs material; do not copy it verbatim, turn the key facts into questions:\n"""\n${sourceText.slice(0, 4000)}\n"""`)
  }
  parts.push('Return ONLY the JSON array.')
  return parts.join('\n')
}

// Parse the model output into an array of question objects. Tolerant of code
// fences / stray prose around the JSON.
export function parseQuestions(raw) {
  let text = (raw || '').trim()
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('AI did not return a JSON array')
  const arr = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(arr)) throw new Error('Parsed result is not an array')
  return arr
}

// Client-side sanity check mirroring the DB validate_draft questions rules, so
// we avoid inserting obviously-broken drafts. Returns { ok, reason }.
export function checkQuestion(q) {
  if (!q || typeof q !== 'object') return { ok: false, reason: 'not an object' }
  if (!q.question || q.question.trim().length < 10) return { ok: false, reason: 'question too short' }
  for (const o of ['option_a','option_b','option_c','option_d']) {
    if (!q[o] || !String(q[o]).trim()) return { ok: false, reason: `missing ${o}` }
  }
  if (!['A','B','C','D'].includes(String(q.correct_answer || '').toUpperCase())) return { ok: false, reason: 'invalid correct_answer' }
  if (!q.explanation || q.explanation.trim().length < 10) return { ok: false, reason: 'missing explanation' }
  if (q.difficulty && !['easy','medium','hard'].includes(q.difficulty)) return { ok: false, reason: 'invalid difficulty' }
  return { ok: true }
}

// Generate a batch and insert valid ones as question drafts. Returns a summary.
// examSlug is optional and stored in json_data for publish-time exam linkage.
export async function generateQuestionDrafts({ count, exam, examSlug, subject, topic, sourceText }) {
  const prompt = buildQuestionPrompt({ count, exam, subject, topic, sourceText })
  const raw = await callGroq(QUESTION_SYSTEM, [{ role: 'user', content: prompt }])
  const parsed = parseQuestions(raw)

  const rows = []
  let skipped = 0
  const seen = new Set()
  for (const q of parsed) {
    const chk = checkQuestion(q)
    if (!chk.ok) { skipped++; continue }
    // local dedupe within the batch
    const key = q.question.trim().toLowerCase()
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)

    rows.push({
      content_type: 'questions',
      title: q.question.slice(0, 120),
      status: 'draft',
      ai_model: 'llama-3.1-8b-instant',
      json_data: {
        question: q.question.trim(),
        option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
        correct_answer: String(q.correct_answer).toUpperCase(),
        explanation: q.explanation.trim(),
        subject: subject || q.subject || null,
        topic: topic || q.topic || null,
        subtopic: q.subtopic || null,
        difficulty: q.difficulty || 'medium',
        tags: Array.isArray(q.tags) ? q.tags : [],
        exam_slug: examSlug || null,
        language: 'en',
      },
    })
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped, total: parsed.length }
  }
  const { error } = await supabase.from('ai_drafts').insert(rows)
  if (error) throw new Error(error.message)
  return { inserted: rows.length, skipped, total: parsed.length }
}

// ── Explanation enrichment (Phase 4 item 4) ──────────────────────────────────
// Generates richer explanation fields for an existing question. Returns an
// object; the caller decides whether to store it (e.g. into metadata).
const EXPLANATION_SYSTEM = `You enrich competitive-exam MCQs with study aids.
Given a question, its options, and the correct answer, return ONLY valid JSON with keys:
detailed_explanation, short_explanation, key_points (array), memory_trick, common_mistakes (array), difficulty_reasoning.
Be factual and concise. No markdown, no preamble.`

export async function generateExplanation(question) {
  const user = `Question: ${question.question}
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}
Correct answer: ${question.correct_answer}
Return ONLY the JSON object.`
  const raw = await callGroq(EXPLANATION_SYSTEM, [{ role: 'user', content: user }])
  let text = (raw || '').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim()
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('AI did not return a JSON object')
  return JSON.parse(text.slice(s, e + 1))
}
