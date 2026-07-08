import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import {
  Brain, FileText, BarChart2, Trophy, Clock, Star, LogOut, User, Zap,
  BookOpen, Crown, Bookmark, Newspaper, TrendingUp, Target, Medal,
  PlayCircle, Trash2, ChevronRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadSession } from '../../lib/testSession'
import toast from 'react-hot-toast'

// ── helpers ──────────────────────────────────────────────────────────────────
function pctOf(r) {
  if (typeof r.percentage === 'number') return r.percentage
  return r.total > 0 ? Math.round((r.score / r.total) * 100) : 0
}
function pctColor(pct) {
  if (pct >= 70) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}
function pctBar(pct) {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Lightweight SVG trend chart (no chart library needed) ────────────────────
function TrendChart({ data }) {
  if (data.length < 2) return null
  const W = 600, H = 160, PAD = 8
  const step = (W - PAD * 2) / (data.length - 1)
  const y = v => H - PAD - (v / 100) * (H - PAD * 2)
  const points = data.map((d, i) => `${PAD + i * step},${y(d.pct)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" preserveAspectRatio="none" role="img" aria-label="Score trend">
      {[25, 50, 75].map(g => (
        <line key={g} x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)}
          className="stroke-gray-200 dark:stroke-gray-800" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      <polyline points={points} fill="none" strokeWidth="3" strokeLinecap="round"
        strokeLinejoin="round" className="stroke-primary-600" />
      {data.map((d, i) => (
        <circle key={i} cx={PAD + i * step} cy={y(d.pct)} r="4" className="fill-primary-600" />
      ))}
    </svg>
  )
}

export default function StudentDashboard() {
  const { user, profile, signOut, isPro } = useAuth()
  const navigate = useNavigate()

  const [results,     setResults]     = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [bookmarks,   setBookmarks]   = useState([])   // [{bookmark, article}]
  const [latestCA,    setLatestCA]    = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    let cancelled = false

    async function loadAll() {
      const [resQ, lbQ, bmQ, caQ] = await Promise.all([
        supabase.from('mock_results').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.rpc('get_leaderboard', { limit_count: 10 }),
        supabase.from('bookmarks').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('current_affairs').select('id, title, category, published_date')
          .order('published_date', { ascending: false }).limit(5),
      ])
      if (cancelled) return

      setResults(resQ.data || [])
      setLeaderboard(lbQ.data || [])
      setLatestCA(caQ.data || [])

      // hydrate current-affairs bookmarks
      const bms   = bmQ.data || []
      const caIds = bms.filter(b => b.item_type === 'current_affairs' && b.item_id).map(b => b.item_id)
      if (caIds.length > 0) {
        const { data: arts } = await supabase.from('current_affairs')
          .select('id, title, category, published_date').in('id', caIds)
        if (cancelled) return
        const byId = Object.fromEntries((arts || []).map(a => [a.id, a]))
        setBookmarks(bms.map(b => ({ bookmark: b, article: byId[b.item_id] || null })))
      } else {
        setBookmarks(bms.map(b => ({ bookmark: b, article: null })))
      }
      setLoading(false)
    }
    loadAll()
    return () => { cancelled = true }
  }, [user])

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out!')
    navigate('/')
  }

  async function removeBookmark(id) {
    const { error } = await supabase.from('bookmarks').delete().eq('id', id)
    if (error) { toast.error('Could not remove bookmark'); return }
    setBookmarks(prev => prev.filter(x => x.bookmark.id !== id))
    toast.success('Bookmark removed')
  }

  if (!user) return null

  // ── derived stats ───────────────────────────────────────────────────────────
  const avgScore  = results.length ? Math.round(results.reduce((a, r) => a + pctOf(r), 0) / results.length) : 0
  const bestScore = results.length ? Math.max(...results.map(pctOf)) : 0
  const lastTest  = results[0] || null

  // weak-subject aggregation across saved subject_stats
  const subjectAgg = {}
  for (const r of results) {
    if (!r.subject_stats) continue
    for (const [subj, s] of Object.entries(r.subject_stats)) {
      if (!subjectAgg[subj]) subjectAgg[subj] = { correct: 0, wrong: 0, total: 0 }
      subjectAgg[subj].correct += s.correct || 0
      subjectAgg[subj].wrong   += s.wrong   || 0
      subjectAgg[subj].total   += s.total   || 0
    }
  }
  const subjects = Object.entries(subjectAgg)
    .map(([name, s]) => ({ name, ...s, pct: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)

  const trend = [...results].reverse().slice(-10).map(r => ({ pct: pctOf(r) }))

  return (
    <Layout>
      <Helmet><title>My Dashboard - AP TS Exam Hub</title></Helmet>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
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

        {/* ── Pro upgrade banner ── */}
        {!isPro && (
          <div className="card p-5 mb-6 bg-gradient-to-r from-purple-600 to-primary-600 text-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-bold text-lg">Upgrade to Pro — ₹99/month</p>
                <p className="text-purple-100 text-sm">Unlimited Genius AI + Mock Tests + Study Plans</p>
              </div>
              <Link to="/subscribe" className="bg-white text-purple-700 font-bold px-5 py-2 rounded-xl hover:bg-purple-50 transition-colors text-sm">
                Upgrade Now
              </Link>
            </div>
          </div>
        )}

        {/* ── Progress stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: FileText,   label: 'Tests Taken', value: results.length,  color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
            { icon: Trophy,     label: 'Avg Score',   value: `${avgScore}%`,  color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
            { icon: TrendingUp, label: 'Best Score',  value: `${bestScore}%`, color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
            { icon: Star,       label: 'Plan',        value: isPro ? 'Pro' : 'Free', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
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

        {/* ── Continue Study ── */}
        <h2 className="font-bold text-lg mb-4">Continue Study</h2>
        {(() => {
          const unfinished = loadSession()
          if (!unfinished) return null
          return (
            <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3 border-2 border-yellow-200 dark:border-yellow-800/60 bg-yellow-50/50 dark:bg-yellow-900/10">
              <div className="flex items-center gap-3">
                <PlayCircle className="h-8 w-8 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Unfinished: {unfinished.testTitle}</p>
                  <p className="text-xs text-gray-500">{Object.keys(unfinished.answers || {}).length}/{unfinished.questions.length} answered — resume where you left off</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/mock-test/start', { state: { testId: unfinished.testId, title: unfinished.testTitle } })}
                className="btn-primary text-sm py-2">
                Resume Test <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )
        })()}
        {lastTest && (
          <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3 border-2 border-primary-100 dark:border-primary-900/40">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">{lastTest.test_title || lastTest.test_id}</p>
                <p className="text-xs text-gray-500">
                  Last attempt: <span className={pctColor(pctOf(lastTest))}>{pctOf(lastTest)}%</span> · {new Date(lastTest.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/mock-test/start', { state: { testId: lastTest.test_id, title: lastTest.test_title || lastTest.test_id } })}
              className="btn-primary text-sm py-2">
              Practice Again <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {[
            { to: '/genius-ai',       icon: Brain,    label: 'Genius AI' },
            { to: '/mock-tests',      icon: FileText, label: 'Mock Tests' },
            { to: '/daily-quiz',      icon: Zap,      label: 'Daily Quiz' },
            { to: '/current-affairs', icon: BookOpen, label: 'Current Affairs' },
            { to: '/previous-papers', icon: FileText, label: 'Papers' },
            { to: '/job-alerts',      icon: Trophy,   label: 'Job Alerts' },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="card p-3 text-center hover:shadow-md transition-shadow">
              <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary-600" />
              <p className="font-semibold text-xs">{label}</p>
            </Link>
          ))}
        </div>

        {/* ── Performance chart + weak subjects ── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="card p-5">
            <h2 className="font-bold text-base mb-1 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary-600" /> Performance Trend
            </h2>
            <p className="text-xs text-gray-400 mb-3">Your last {Math.min(trend.length, 10)} test scores</p>
            {trend.length >= 2 ? (
              <TrendChart data={trend} />
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">Take at least 2 tests to see your trend.</p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-base mb-1 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary-600" /> Weak Subject Analysis
            </h2>
            <p className="text-xs text-gray-400 mb-3">Aggregated across your saved tests</p>
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Complete a mock test to see subject-wise analysis.</p>
            ) : (
              <div className="space-y-3">
                {subjects.slice(0, 5).map(s => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className={`font-bold ${pctColor(s.pct)}`}>{s.pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className={`h-2 rounded-full ${pctBar(s.pct)}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
                {subjects[0] && subjects[0].pct < 50 && (
                  <div className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 px-3 py-2 rounded-lg">
                    Weakest area: <b>{subjects[0].name}</b> — <Link to="/genius-ai" className="underline">ask Genius AI</Link> for a study plan.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── History + side column ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Mock test history */}
          <div className="lg:col-span-2">
            <h2 className="font-bold text-lg mb-4">Mock Test History</h2>
            {loading ? (
              <div className="card p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : results.length === 0 ? (
              <div className="card p-8 text-center text-gray-400">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No tests taken yet.</p>
                <Link to="/mock-tests" className="btn-primary mt-3 inline-flex">Start a Mock Test</Link>
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Test</th>
                      <th className="px-4 py-3 text-left font-semibold">Score</th>
                      <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Accuracy</th>
                      <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Time</th>
                      <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {results.map(r => {
                      const pct = pctOf(r)
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 font-medium">{r.test_title || r.test_id}</td>
                          <td className="px-4 py-3">
                            <span className={`badge ${pct >= 70 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {r.score}/{r.total} ({pct}%)
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-500">{typeof r.accuracy === 'number' ? `${r.accuracy}%` : '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-500"><Clock className="inline h-3.5 w-3.5 mr-1" />{r.time_taken}s</td>
                          <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Side column */}
          <div className="space-y-6">

            {/* Subscription status */}
            <div>
              <h2 className="font-bold text-lg mb-4">Subscription</h2>
              <div className="card p-5">
                {isPro ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      <p className="font-bold">Pro Member</p>
                    </div>
                    <p className="text-sm text-gray-500">
                      Valid till {profile?.pro_expires_at ? new Date(profile.pro_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold mb-1">Free Plan</p>
                    <p className="text-sm text-gray-500 mb-3">2 free mock tests · limited Genius AI</p>
                    <Link to="/subscribe" className="btn-primary text-sm py-2 w-full justify-center">Upgrade to Pro</Link>
                  </>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            <div>
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Medal className="h-5 w-5 text-yellow-500" /> Leaderboard</h2>
              <div className="card p-4">
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No scores yet — be the first on the board!</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map(row => (
                      <div key={row.rank}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${row.is_me ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-bold w-6 text-center flex-shrink-0 ${row.rank === 1 ? 'text-yellow-500' : row.rank === 2 ? 'text-gray-400' : row.rank === 3 ? 'text-amber-700' : 'text-gray-500'}`}>
                            {row.rank}
                          </span>
                          <span className="font-medium truncate">{row.display_name}{row.is_me ? ' (You)' : ''}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-primary-600">{row.avg_percentage}%</span>
                          <span className="text-xs text-gray-400 ml-1">({row.tests_taken})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bookmarks */}
            <div>
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Bookmark className="h-5 w-5 text-primary-600" /> Bookmarks</h2>
              <div className="card p-4">
                {bookmarks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No bookmarks yet. Tap the <Bookmark className="inline h-3.5 w-3.5" /> icon on any <Link to="/current-affairs" className="text-primary-600 underline">current affairs</Link> article.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bookmarks.map(({ bookmark, article }) => (
                      <div key={bookmark.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to="/current-affairs" className="text-sm font-medium hover:text-primary-600 line-clamp-2">
                            {article?.title || 'Saved item'}
                          </Link>
                          {article?.category && <span className="text-xs text-gray-400">{article.category}</span>}
                        </div>
                        <button onClick={() => removeBookmark(bookmark.id)}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0 p-1" title="Remove bookmark">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Current affairs history */}
            <div>
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary-600" /> Latest Current Affairs</h2>
              <div className="card p-4">
                {latestCA.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No articles yet.</p>
                ) : (
                  <div className="space-y-3">
                    {latestCA.map(a => (
                      <Link key={a.id} to="/current-affairs" className="block group">
                        <p className="text-sm font-medium group-hover:text-primary-600 line-clamp-2">{a.title}</p>
                        <p className="text-xs text-gray-400">
                          {a.category}{a.published_date ? ` · ${new Date(a.published_date).toLocaleDateString('en-IN')}` : ''}
                        </p>
                      </Link>
                    ))}
                    <Link to="/current-affairs" className="text-sm text-primary-600 font-medium inline-flex items-center gap-1">
                      View all <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}
