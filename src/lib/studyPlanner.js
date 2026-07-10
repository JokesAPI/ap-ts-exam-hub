// ── AI Study Planner (Phase 6) ───────────────────────────────────────────────
// Generates a personalized study plan using the existing server-side Groq
// backend (src/lib/groq.js). Reuses mockStats (weak subjects, recommendations)
// and writes to the normalized study_plans / study_plan_tasks tables (own-row
// RLS). No provider-specific logic beyond callGroq.

import { callGroq } from './groq'
import { supabase } from './supabase'
import { aggregateSubjects } from './mockStats'

const PLANNER_SYSTEM = `You are an expert study planner for Indian competitive government exams
(APPSC, TGPSC, SSC, RRB, Banking, TG DSC, AP/TG Police).
Given an exam, days remaining, daily study minutes, and the student's weak/strong
subjects, produce a realistic day-by-day plan.
Rules:
- Front-load weak subjects; interleave revision every few days; rotate subjects.
- Include periodic mock tests and previous-paper practice.
- Keep each day's total within the available minutes.
- Output ONLY valid JSON: an array of days. Each day is an object:
  { "day": <int>, "tasks": [ { "task_type": "study|revision|mock_test|previous_paper|current_affairs",
    "subject": <string|null>, "topic": <string|null>, "estimated_minutes": <int> } ] }
No markdown, no preamble.`

// Build the user prompt from real signals.
export function buildPlannerPrompt({ examTitle, days, dailyMinutes, weak, strong }) {
  return [
    `Exam: ${examTitle || 'General competitive exam'}.`,
    `Days available: ${days}.`,
    `Daily study time: ${dailyMinutes} minutes.`,
    weak.length ? `Weak subjects (prioritize): ${weak.join(', ')}.` : 'No mock history yet — cover the core syllabus evenly.',
    strong.length ? `Stronger subjects (lighter touch): ${strong.join(', ')}.` : '',
    `Produce at most ${Math.min(days, 30)} days of plan. Return ONLY the JSON array.`,
  ].filter(Boolean).join('\n')
}

export function parsePlan(raw) {
  let t = (raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const s = t.indexOf('['), e = t.lastIndexOf(']')
  if (s === -1 || e === -1) throw new Error('AI did not return a JSON array')
  const arr = JSON.parse(t.slice(s, e + 1))
  if (!Array.isArray(arr)) throw new Error('Parsed plan is not an array')
  return arr
}

// Derive weak/strong subjects from real mock_results (reuses mockStats).
export function deriveSubjects(mockResults) {
  const subjects = aggregateSubjects(mockResults)
  const weak = subjects.filter(s => s.pct < 60).map(s => s.name)
  const strong = subjects.filter(s => s.pct >= 75).map(s => s.name)
  return { weak, strong, all: subjects }
}

// Generate a plan and persist it (archives any prior active plan for the user).
// Returns { planId, taskCount }.
export async function generateAndSavePlan({ user, exam, dailyMinutes, mockResults }) {
  const target = exam?.exam_date || null
  const days = target
    ? Math.max(1, Math.ceil((new Date(target) - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30
  const cappedDays = Math.min(days, 30)

  const { weak, strong } = deriveSubjects(mockResults || [])
  const prompt = buildPlannerPrompt({ examTitle: exam?.title, days: cappedDays, dailyMinutes, weak, strong })
  const raw = await callGroq(PLANNER_SYSTEM, [{ role: 'user', content: prompt }])
  const planDays = parsePlan(raw)

  // archive existing active plans (one active plan per user)
  await supabase.from('study_plans').update({ status: 'archived' })
    .eq('user_id', user.id).eq('status', 'active')

  const { data: plan, error: planErr } = await supabase.from('study_plans').insert([{
    user_id: user.id,
    exam_id: exam?.id || null,
    status: 'active',
    target_exam_date: target,
    daily_minutes: dailyMinutes,
  }]).select('id').single()
  if (planErr) throw new Error(planErr.message)

  // flatten to normalized tasks
  const tasks = []
  for (const d of planDays) {
    const dayNum = Number(d.day) || (tasks.length ? tasks[tasks.length - 1].day_number + 1 : 1)
    ;(d.tasks || []).forEach((t, i) => {
      const type = ['study', 'revision', 'mock_test', 'previous_paper', 'current_affairs'].includes(t.task_type)
        ? t.task_type : 'study'
      tasks.push({
        study_plan_id: plan.id,
        day_number: dayNum,
        task_type: type,
        subject: t.subject || null,
        topic: t.topic || null,
        estimated_minutes: Number(t.estimated_minutes) || null,
        sort_order: i,
      })
    })
  }
  if (tasks.length === 0) throw new Error('AI produced no tasks; please try again')

  const { error: taskErr } = await supabase.from('study_plan_tasks').insert(tasks)
  if (taskErr) throw new Error(taskErr.message)

  return { planId: plan.id, taskCount: tasks.length }
}
