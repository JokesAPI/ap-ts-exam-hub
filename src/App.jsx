import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// ── Eager shell — required for first paint / most frequent unauthenticated
//    navigation. Everything else is route-level code split below. ──────────
import Home  from './pages/public/Home'
import Login from './pages/public/Login'

// ── Public pages (lazy) ──────────────────────────────────────────────────────
const Notifications    = lazy(() => import('./pages/public/Notifications'))
const Exams             = lazy(() => import('./pages/public/Exams'))
const CurrentAffairs   = lazy(() => import('./pages/public/CurrentAffairs'))
const PreviousPapers   = lazy(() => import('./pages/public/PreviousPapers'))
const AboutUs           = lazy(() => import('./pages/public/AboutUs'))
const Contact            = lazy(() => import('./pages/public/Contact'))
const PrivacyPolicy     = lazy(() => import('./pages/public/PrivacyPolicy'))
const GeniusAI          = lazy(() => import('./pages/public/GeniusAI'))
const DailyQuiz         = lazy(() => import('./pages/public/DailyQuiz'))
const MockTests         = lazy(() => import('./pages/public/MockTests'))
const MockTestEngine    = lazy(() => import('./pages/public/MockTestEngine'))
const JobAlerts         = lazy(() => import('./pages/public/JobAlerts'))
const StudentDashboard  = lazy(() => import('./pages/public/StudentDashboard'))
const AttemptHistory     = lazy(() => import('./pages/public/AttemptHistory'))
const Subscribe         = lazy(() => import('./pages/public/Subscribe'))

// ── Admin pages (lazy) — already gated behind AdminRoute's auth check ──────
const AdminLogin          = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard      = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminNotifications  = lazy(() => import('./pages/admin/AdminNotifications'))
const AdminExams          = lazy(() => import('./pages/admin/AdminExams'))
const AdminCurrentAffairs = lazy(() => import('./pages/admin/AdminCurrentAffairs'))
const AdminPapers         = lazy(() => import('./pages/admin/AdminPapers'))
const AdminQuestions      = lazy(() => import('./pages/admin/AdminQuestions'))
const AdminDrafts         = lazy(() => import('./pages/admin/AdminDrafts'))
const AdminAutomation     = lazy(() => import('./pages/admin/AdminAutomation'))

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
        <Route path="/attempts"  element={<AuthRoute><AttemptHistory /></AuthRoute>} />

        {/* ── Admin routes — require is_admin = true ── */}
        <Route path="/admin/login"           element={<AdminLogin />} />
        <Route path="/admin"                 element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/notifications"   element={<AdminRoute><AdminNotifications /></AdminRoute>} />
        <Route path="/admin/exams"           element={<AdminRoute><AdminExams /></AdminRoute>} />
        <Route path="/admin/current-affairs" element={<AdminRoute><AdminCurrentAffairs /></AdminRoute>} />
        <Route path="/admin/papers"          element={<AdminRoute><AdminPapers /></AdminRoute>} />
        <Route path="/admin/questions"       element={<AdminRoute><AdminQuestions /></AdminRoute>} />
        <Route path="/admin/drafts"          element={<AdminRoute><AdminDrafts /></AdminRoute>} />
        <Route path="/admin/automation"      element={<AdminRoute><AdminAutomation /></AdminRoute>} />

        {/* ── Fix #11: 404 catch-all ── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
