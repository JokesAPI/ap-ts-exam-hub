// ── ExamPicker — Phase 1 ──────────────────────────────────────────────────────
// Reusable exam selector rendered inside the existing Modal component.
// Used by: Navbar switcher, StudentDashboard "Preparing for" chip, and the
// dashboard first-time prompt. One component — no duplicates.

import Modal from './Modal'
import { useExam, EXAM_CATEGORY_LABELS } from '../context/ExamContext'
import { CheckCircle, Target } from 'lucide-react'

export default function ExamPicker({ open, onClose }) {
  const { exams, selectedExam, selectExam, loadingExams } = useExam()

  const grouped = {}
  for (const e of exams) {
    const cat = e.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(e)
  }

  return (
    <Modal open={open} onClose={onClose} title="Choose your exam" maxWidth="max-w-2xl">
      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1 mb-4 flex items-center gap-1.5">
        <Target className="h-4 w-4 text-primary-600" />
        Your dashboard, mock tests and papers will focus on this exam. You can change it anytime.
      </p>

      {loadingExams ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-pulse">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-11 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Exam catalog unavailable. Please try again later.</p>
      ) : (
        Object.entries(EXAM_CATEGORY_LABELS).map(([cat, label]) => (
          grouped[cat]?.length > 0 && (
            <div key={cat} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {grouped[cat].map(exam => {
                  const active = selectedExam?.id === exam.id
                  return (
                    <button key={exam.id}
                      onClick={() => { selectExam(exam); onClose() }}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all flex items-center gap-2 ${active
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <span className="flex-1">{exam.title}</span>
                      {active && <CheckCircle className="h-4 w-4 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        ))
      )}
    </Modal>
  )
}
