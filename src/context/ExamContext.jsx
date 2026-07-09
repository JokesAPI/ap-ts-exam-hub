// ── ExamContext — Phase 1: Exam-Centric Foundation ───────────────────────────
// Single source of truth for the exam catalog and the user's PRIMARY exam.
//
// Resolution order:
//   1. profiles.selected_exam_id (signed-in users — profile always wins)
//   2. localStorage slug          (guests)
// On login, a guest's choice is synced into the profile once (only if the
// profile has no selection yet).
//
// Multi-exam future: this context deliberately exposes a single
// `selectedExam` (primary). Adding multi-exam later means a `user_exams`
// junction table + an `enrolledExams` array here — no breaking changes.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const ExamContext = createContext()
const GUEST_EXAM_KEY = 'selected_exam_slug'

export const EXAM_CATEGORY_LABELS = {
  'state-psc': 'State PSC',
  'entrance':  'Entrance Exams',
  'teaching':  'Teaching (TET / DSC)',
  'police':    'Police',
  'ssc':       'SSC',
  'railway':   'Railway',
  'banking':   'Banking',
}

export function ExamProvider({ children }) {
  const { user, profile, fetchProfile } = useAuth()
  const [exams, setExams] = useState([])
  const [loadingExams, setLoadingExams] = useState(true)
  const [guestSlug, setGuestSlug] = useState(() => {
    try { return localStorage.getItem(GUEST_EXAM_KEY) } catch { return null }
  })
  // Local override for instant UI feedback after selection (profile refresh follows)
  const [localExamId, setLocalExamId] = useState(null)

  // Load the seeded catalog (public read via exams_select_public RLS)
  useEffect(() => {
    let mounted = true
    supabase.from('exams')
      .select('id, slug, title, organization, category, state, display_order')
      .eq('is_active', true)
      .not('slug', 'is', null)
      .order('display_order', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) console.error('Exam catalog error:', error)
        setExams(data || [])
        setLoadingExams(false)
      })
    return () => { mounted = false }
  }, [])

  // Profile selection changed (login/refresh) → drop any stale local override
  useEffect(() => { setLocalExamId(null) }, [profile?.selected_exam_id])

  const selectedExam = useMemo(() => {
    if (exams.length === 0) return null
    const id = localExamId || profile?.selected_exam_id
    if (id) return exams.find(e => e.id === id) || null
    if (!user && guestSlug) return exams.find(e => e.slug === guestSlug) || null
    return null
  }, [exams, localExamId, profile?.selected_exam_id, user, guestSlug])

  // One-time sync: guest choice → profile (only when profile has none)
  useEffect(() => {
    if (!user || !profile || profile.selected_exam_id || !guestSlug || exams.length === 0) return
    const exam = exams.find(e => e.slug === guestSlug)
    if (!exam) return
    supabase.from('profiles').update({ selected_exam_id: exam.id }).eq('id', user.id)
      .then(({ error }) => { if (!error) fetchProfile(user.id) })
  }, [user, profile, guestSlug, exams])

  async function selectExam(exam) {
    if (!exam) return
    setLocalExamId(exam.id)
    try { localStorage.setItem(GUEST_EXAM_KEY, exam.slug) } catch {}
    setGuestSlug(exam.slug)
    if (user) {
      const { error } = await supabase.from('profiles')
        .update({ selected_exam_id: exam.id }).eq('id', user.id)
      if (error) {
        console.error('selectExam error:', error)
        toast.error('Could not save your exam choice')
        return
      }
      fetchProfile(user.id)
    }
    toast.success(`Now preparing for ${exam.title}`)
  }

  const value = useMemo(
    () => ({ exams, selectedExam, selectExam, loadingExams }),
    [exams, selectedExam, loadingExams]
  )

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>
}

export const useExam = () => useContext(ExamContext)
