import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { Brain, FileText, BarChart2, Trophy, Clock, Star, LogOut, User, Zap, BookOpen, Crown, Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadSubjectStats } from '../../lib/attempts'
import { loadTestCatalog, resolveAccess } from '../../lib/officialTests'
import { getStudyGoal } from '../../lib/performance'
import toast from 'react-hot-toast'

export default function StudentDashboard() {
  const { user, profile, signOut, isPro } = useAuth()
  const [results, setResults] = useState([])
  const [studyGoal, setStudyGoal] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    // Explicit column list: `answers` and `subject_stats` are large jsonb blobs
    // (full question text, all options and explanations for every question) and
    // are not rendered here. select('*') downloaded them for every row.
    supabase.from('mock_results')
      .select('id, test_id, test_title, score, total, percentage, time_taken, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setResults(data || []))

    // Today's Study Goal: weakest subject + a matching active test, if one
    // exists. Silent, best-effort -- if either fetch fails or there's
    // nothing real to recommend, the card simply doesn't render. No "no
    // data" state, matching every other soft-failure in this effect.
    Promise.all([loadSubjectStats(supabase, user.id), loadTestCatalog(supabase)])
      .then(([subjectStatsList, testCatalog]) => setStudyGoal(getStudyGoal(subjectStatsList, testCatalog)))
      .catch(() => setStudyGoal(null))
  }, [user])

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out!')
    navigate('/')
  }

  // Same access resolution MockTests.jsx uses for every test start -- never
  // bypasses public/free/premium gating just because this button lives on
  // the dashboard instead of the test catalog.
  function startRecommendedTest(test) {
    const access = resolveAccess(test.access_tier, { user, isPro })
    if (access === 'login')   { navigate('/login'); return }
    if (access === 'upgrade') { navigate('/subscribe'); return }
    navigate('/mock-test/start', { state: { testId: test.test_id, title: test.title } })
  }

  if (!user) return null

  // Use the stored `percentage` column. Recomputing score/total discards the
  // negative marking (-1/3 per wrong answer) that the test engine applies when
  // the result is written, so the two values legitimately differ.
  const scored = results.filter(r => typeof r.percentage === 'number')
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((a, r) => a + r.percentage, 0) / scored.length)
    : 0

  return (
    <Layout>
      <Helmet><title>My Dashboard - AP TS Exam Hub</title></Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
              <User className="h-7 w-7 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Welcome, {profile?.full_name || 'Student'}! 👋</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{user.email}</p>
              {isPro ? (
                <span className="inline-flex items-center gap-1 badge bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 mt-1">
                  <Crown className="h-3 w-3" /> Pro Member
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 mt-1">
                  Free Plan
                </span>
              )}
            </div>
          </div>
          <button onClick={handleSignOut} className="btn-secondary text-sm">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>

        {/* Pro upgrade banner */}
        {!isPro && (
          <div className="card p-5 mb-6 bg-gradient-to-r from-purple-600 to-primary-600 text-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-bold text-lg">Upgrade to Pro — ₹199/month</p>
                <p className="text-purple-100 text-sm">Unlimited Genius AI + Mock Tests + Study Plans</p>
              </div>
              <Link to="/subscribe" className="bg-white text-purple-700 font-bold px-5 py-2 rounded-xl hover:bg-purple-50 transition-colors text-sm">
                Upgrade Now
              </Link>
            </div>
          </div>
        )}

        {/* Today's Study Goal — only rendered when there's a real weak subject
            AND a real active test to recommend for it. No empty/"no data" state. */}
        {studyGoal && (
          <div className="card p-5 mb-6 border-2 border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <Target className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-bold">Today's Study Goal: {studyGoal.subject}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Your accuracy here is {studyGoal.accuracy}% — practice to improve it</p>
                </div>
              </div>
              <button onClick={() => startRecommendedTest(studyGoal.test)} className="btn-primary text-sm py-2 whitespace-nowrap">
                Start Practice
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: FileText, label: 'Tests Taken', value: results.length, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
            { icon: Trophy, label: 'Avg Score', value: `${avgScore}%`, color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
            { icon: Star, label: 'Plan', value: isPro ? 'Pro' : 'Free', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card p-4">
              <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-2`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <h2 className="font-bold text-lg mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { to: '/genius-ai', icon: Brain, label: 'Genius AI', desc: 'Ask doubts, get study plans', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
            { to: '/mock-tests', icon: FileText, label: 'Mock Tests', desc: 'Practice with real questions', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
            { to: '/daily-quiz', icon: Zap, label: 'Daily Quiz', desc: 'Today\'s 10 questions', color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
            { to: '/current-affairs', icon: BookOpen, label: 'Current Affairs', desc: 'Daily GK updates', color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
            { to: '/previous-papers', icon: FileText, label: 'Previous Papers', desc: 'Download old papers', color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
            { to: '/job-alerts', icon: Trophy, label: 'Job Alerts', desc: 'Latest vacancies', color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
          ].map(({ to, icon: Icon, label, desc, color }) => (
            <Link key={to} to={to} className={`card p-4 border-2 ${color} hover:shadow-md transition-shadow`}>
              <Icon className="h-5 w-5 mb-2 text-gray-600 dark:text-gray-400" />
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent results */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Recent Test Results</h2>
          {results.length > 0 && (
            <Link to="/attempts" className="text-sm text-primary-600 hover:underline">View all →</Link>
          )}
        </div>
        {results.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No tests taken yet.</p>
            <Link to="/mock-tests" className="btn-primary mt-3 inline-flex">Start a Mock Test</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Test</th>
                  <th className="px-4 py-3 text-left font-semibold">Score</th>
                  <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Time</th>
                  <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium">{r.test_title || r.test_id}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${typeof r.percentage !== 'number' ? 'bg-gray-100 text-gray-600' : r.percentage >= 80 ? 'bg-green-100 text-green-700' : r.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {r.score}/{r.total}{typeof r.percentage === 'number' ? ` (${r.percentage}%)` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{r.time_taken}s</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
