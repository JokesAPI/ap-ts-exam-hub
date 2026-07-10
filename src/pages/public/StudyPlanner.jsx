import { useEffect, useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { useExam } from '../../context/ExamContext'
import { supabase } from '../../lib/supabase'
import { generateAndSavePlan } from '../../lib/studyPlanner'
import {
  Sparkles, CheckCircle2, Circle, Calendar, Clock, Flame, Target,
  BookOpen, RotateCcw, FileText, Newspaper, ListChecks, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_META = {
  study:           { icon: BookOpen,  label: 'Study',          cls: 'text-blue-600' },
  revision:        { icon: RotateCcw, label: 'Revision',       cls: 'text-purple-600' },
  mock_test:       { icon: ListChecks,label: 'Mock Test',      cls: 'text-green-600' },
  previous_paper:  { icon: FileText,  label: 'Previous Paper', cls: 'text-amber-600' },
  current_affairs: { icon: Newspaper, label: 'Current Affairs',cls: 'text-teal-600' },
}

export default function StudyPlanner() {
  const { user } = useAuth()
  const { selectedExam } = useExam()
  const navigate = useNavigate()

  const [plan, setPlan] = useState(null)       // study_plans row
  const [tasks, setTasks] = useState([])       // study_plan_tasks rows
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [dailyMinutes, setDailyMinutes] = useState(120)
  const [view, setView] = useState('list')     // list | calendar

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    let cancelled = false
    async function load() {
      const { data: plans } = await supabase.from('study_plans')
        .select('*').eq('user_id', user.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1)
      if (cancelled) return
      const active = plans?.[0] || null
      setPlan(active)
      if (active) {
        const { data: t } = await supabase.from('study_plan_tasks')
          .select('*').eq('study_plan_id', active.id)
          .order('day_number', { ascending: true }).order('sort_order', { ascending: true })
        if (!cancelled) setTasks(t || [])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function handleGenerate() {
    if (!user) return
    setGenerating(true)
    try {
      const { data: mockResults } = await supabase.from('mock_results')
        .select('percentage, score, total, subject_stats').eq('user_id', user.id).limit(50)
      const res = await generateAndSavePlan({ user, exam: selectedExam, dailyMinutes, mockResults: mockResults || [] })
      // reload
      const { data: plans } = await supabase.from('study_plans')
        .select('*').eq('id', res.planId).single()
      const { data: t } = await supabase.from('study_plan_tasks')
        .select('*').eq('study_plan_id', res.planId)
        .order('day_number', { ascending: true }).order('sort_order', { ascending: true })
      setPlan(plans); setTasks(t || [])
      toast.success(`Study plan ready — ${res.taskCount} tasks!`)
    } catch (e) {
      toast.error('Could not generate plan: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function toggleTask(task) {
    const next = !task.completed
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: next, completed_at: next ? new Date().toISOString() : null } : t))
    const { error } = await supabase.from('study_plan_tasks')
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq('id', task.id)
    if (error) {
      toast.error('Could not update task')
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
    }
  }

  // ── derived progress ──────────────────────────────────────────────────────
  const done = tasks.filter(t => t.completed).length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const daysRemaining = plan?.target_exam_date
    ? Math.max(0, Math.ceil((new Date(plan.target_exam_date) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  // streak: distinct completed-on dates ending today/yesterday
  const streak = useMemo(() => {
    const dates = new Set(tasks.filter(t => t.completed_at).map(t => new Date(t.completed_at).toDateString()))
    let s = 0
    const d = new Date()
    // allow today or yesterday to start the streak
    if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
    while (dates.has(d.toDateString())) { s++; d.setDate(d.getDate() - 1) }
    return s
  }, [tasks])

  const byDay = useMemo(() => {
    const m = {}
    for (const t of tasks) (m[t.day_number] = m[t.day_number] || []).push(t)
    return m
  }, [tasks])
  const dayNumbers = Object.keys(byDay).map(Number).sort((a, b) => a - b)

  // next milestone: first day with any incomplete task
  const nextDay = dayNumbers.find(d => byDay[d].some(t => !t.completed))

  if (!user) return null

  return (
    <Layout>
      <Helmet><title>AI Study Planner - AP TS Exam Hub</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
            <Target className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Study Planner</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedExam ? `Personalized for ${selectedExam.title}` : 'Set your exam for a tailored plan'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : !plan ? (
          /* ── No plan yet: generator ── */
          <div className="card p-8 text-center max-w-md mx-auto">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary-600" />
            <h2 className="text-lg font-bold mb-1">Create your study plan</h2>
            <p className="text-sm text-gray-500 mb-5">
              A personalized day-by-day roadmap based on your exam{selectedExam?.exam_date ? ', its date,' : ''} and your mock-test performance.
            </p>
            <label className="block text-sm font-medium mb-1 text-left">Daily study time</label>
            <select className="input mb-4" value={dailyMinutes} onChange={e => setDailyMinutes(Number(e.target.value))}>
              {[60, 90, 120, 180, 240].map(m => <option key={m} value={m}>{m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} min`} / day</option>)}
            </select>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center">
              <Sparkles className="h-4 w-4" /> {generating ? 'Generating…' : 'Generate Plan'}
            </button>
            {!selectedExam && (
              <p className="text-xs text-gray-400 mt-3">Tip: <Link to="/exams" className="text-primary-600 underline">pick your exam</Link> first for a sharper plan.</p>
            )}
          </div>
        ) : (
          <>
            {/* ── Progress header ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Progress', value: `${pct}%`, icon: Target },
                { label: 'Completed', value: `${done}/${tasks.length}`, icon: CheckCircle2 },
                { label: 'Streak', value: `${streak}🔥`, icon: Flame },
                { label: 'Days left', value: daysRemaining ?? '—', icon: Clock },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="card p-4">
                  <Icon className="h-4 w-4 text-primary-600 mb-1.5" />
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
              <div className="h-2.5 rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
            </div>

            {/* view toggle + regenerate */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex gap-2">
                <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>List</button>
                <button onClick={() => setView('calendar')} className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${view === 'calendar' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}><Calendar className="h-3.5 w-3.5" /> Calendar</button>
              </div>
              <button onClick={handleGenerate} disabled={generating} className="btn-secondary text-sm">
                <RotateCcw className="h-4 w-4" /> {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>

            {/* ── List view ── */}
            {view === 'list' && (
              <div className="space-y-5">
                {dayNumbers.map(day => (
                  <div key={day} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-sm flex items-center gap-2">
                        Day {day}
                        {day === nextDay && <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Next</span>}
                      </p>
                      <span className="text-xs text-gray-400">
                        {byDay[day].filter(t => t.completed).length}/{byDay[day].length} done
                      </span>
                    </div>
                    <div className="space-y-2">
                      {byDay[day].map(task => {
                        const meta = TYPE_META[task.task_type] || TYPE_META.study
                        const Icon = meta.icon
                        return (
                          <button key={task.id} onClick={() => toggleTask(task)}
                            className="w-full flex items-center gap-3 text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            {task.completed
                              ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                              : <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                            <Icon className={`h-4 w-4 flex-shrink-0 ${meta.cls}`} />
                            <span className={`flex-1 text-sm ${task.completed ? 'line-through text-gray-400' : ''}`}>
                              <span className="font-medium">{meta.label}</span>
                              {task.subject ? ` · ${task.subject}` : ''}{task.topic ? ` — ${task.topic}` : ''}
                            </span>
                            {task.estimated_minutes && <span className="text-xs text-gray-400 flex-shrink-0">{task.estimated_minutes}m</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Calendar view ── */}
            {view === 'calendar' && (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dayNumbers.map(day => {
                  const dt = byDay[day]
                  const allDone = dt.every(t => t.completed)
                  const someDone = dt.some(t => t.completed)
                  return (
                    <div key={day}
                      className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center text-center border-2 ${allDone ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800' : someDone ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900' : 'border-gray-200 dark:border-gray-800'}`}>
                      <p className="text-xs text-gray-400">Day</p>
                      <p className="text-lg font-bold">{day}</p>
                      <p className="text-[10px] text-gray-500">{dt.filter(t => t.completed).length}/{dt.length}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
