import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext'

// Public pages — SEO-critical / lightweight: kept eager for fast first paint + crawlability
import Home             from './pages/public/Home'
import Notifications    from './pages/public/Notifications'
import Exams            from './pages/public/Exams'
import CurrentAffairs   from './pages/public/CurrentAffairs'
import PreviousPapers   from './pages/public/PreviousPapers'
import AboutUs          from './pages/public/AboutUs'
import Contact          from './pages/public/Contact'
import PrivacyPolicy    from './pages/public/PrivacyPolicy'
import DailyQuiz        from './pages/public/DailyQuiz'
import MockTests        from './pages/public/MockTests'
import JobAlerts        from './pages/public/JobAlerts'
import Login            from './pages/public/Login'

// Heavy interactive / authenticated public pages — lazy-loaded
const GeniusAI         = lazy(() => import('./pages/public/GeniusAI'))
const MockTestEngine   = lazy(() => import('./pages/public/MockTestEngine'))
const MockAttempts     = lazy(() => import('./pages/public/MockAttempts'))
const StudentDashboard = lazy(() => import('./pages/public/StudentDashboard'))
const Subscribe        = lazy(() => import('./pages/public/Subscribe'))

// Admin pages — admin-only, never needed by students: all lazy-loaded
const AdminLogin          = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard      = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminNotifications  = lazy(() => import('./pages/admin/AdminNotifications'))
const AdminExams          = lazy(() => import('./pages/admin/AdminExams'))
const AdminCurrentAffairs = lazy(() => import('./pages/admin/AdminCurrentAffairs'))
const AdminPapers         = lazy(() => import('./pages/admin/AdminPapers'))
const AdminDrafts         = lazy(() => import('./pages/admin/AdminDrafts'))
const AdminQuestions      = lazy(() => import('./pages/admin/AdminQuestions'))
// Phase 5: heavier admin-only monitoring page — lazy-loaded to keep main bundle small
const AdminAutomation = lazy(() => import('./pages/admin/AdminAutomation'))
// Phase 6: heavier planner page — lazy-loaded to keep main bundle small
const StudyPlanner = lazy(() => import('./pages/public/StudyPlanner'))

// ── Loading spinner ────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
    </div>
  )
}

// ── Fix #2: Admin route — requires is_admin on profile ────────────────────────
function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user)            return <Navigate to="/admin/login" replace />
  if (!profile)         return <Spinner /> // still loading profile
  if (!profile.is_admin) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 px-4 text-center">
      <div className="text-5xl">🚫</div>
      <h1 className="text-xl font-bold text-gray-800">Access Denied</h1>
      <p className="text-gray-500 text-sm">You do not have admin privileges.</p>
      <a href="/" className="text-primary-600 text-sm hover:underline">Go to Home</a>
    </div>
  )
  return children
}

// ── Student protected route — requires login ───────────────────────────────────
function AuthRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? children : <Navigate to="/login" replace />
}

// ── Fix #11: 404 page ─────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 px-4 text-center">
      <div className="text-6xl">404</div>
      <h1 className="text-2xl font-bold text-gray-800">Page Not Found</h1>
      <p className="text-gray-500">The page you are looking for does not exist.</p>
      <a href="/" className="btn-primary mt-2">Go to Home</a>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/"               element={<Home />} />
      <Route path="/notifications"  element={<Notifications />} />
      <Route path="/exams"          element={<Exams />} />
      <Route path="/current-affairs"element={<CurrentAffairs />} />
      <Route path="/previous-papers"element={<PreviousPapers />} />
      <Route path="/about"          element={<AboutUs />} />
      <Route path="/contact"        element={<Contact />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/genius-ai"      element={<GeniusAI />} />
      <Route path="/daily-quiz"     element={<DailyQuiz />} />
      <Route path="/mock-tests"     element={<MockTests />} />
      <Route path="/mock-test/start"element={<MockTestEngine />} />
      <Route path="/job-alerts"     element={<JobAlerts />} />
      <Route path="/login"          element={<Login />} />
      <Route path="/subscribe"      element={<Subscribe />} />

      {/* ── Student protected routes ── */}
      <Route path="/dashboard" element={<AuthRoute><StudentDashboard /></AuthRoute>} />
      <Route path="/mock-tests/attempts" element={<AuthRoute><MockAttempts /></AuthRoute>} />
      <Route path="/study-planner" element={<AuthRoute><StudyPlanner /></AuthRoute>} />

      {/* ── Admin routes — require is_admin = true ── */}
      <Route path="/admin/login"           element={<AdminLogin />} />
      <Route path="/admin"                 element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/notifications"   element={<AdminRoute><AdminNotifications /></AdminRoute>} />
      <Route path="/admin/exams"           element={<AdminRoute><AdminExams /></AdminRoute>} />
      <Route path="/admin/current-affairs" element={<AdminRoute><AdminCurrentAffairs /></AdminRoute>} />
      <Route path="/admin/papers"          element={<AdminRoute><AdminPapers /></AdminRoute>} />
      <Route path="/admin/drafts"          element={<AdminRoute><AdminDrafts /></AdminRoute>} />
      <Route path="/admin/questions"       element={<AdminRoute><AdminQuestions /></AdminRoute>} />
      <Route path="/admin/automation"      element={<AdminRoute><AdminAutomation /></AdminRoute>} />

      {/* ── Fix #11: 404 catch-all ── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
