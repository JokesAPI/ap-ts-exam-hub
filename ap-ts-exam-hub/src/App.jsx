import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Public Pages
import Home from './pages/public/Home'
import Notifications from './pages/public/Notifications'
import Exams from './pages/public/Exams'
import CurrentAffairs from './pages/public/CurrentAffairs'
import PreviousPapers from './pages/public/PreviousPapers'
import AboutUs from './pages/public/AboutUs'
import Contact from './pages/public/Contact'
import PrivacyPolicy from './pages/public/PrivacyPolicy'
import GeniusAI from './pages/public/GeniusAI'
import DailyQuiz from './pages/public/DailyQuiz'
import MockTests from './pages/public/MockTests'
import JobAlerts from './pages/public/JobAlerts'

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminNotifications from './pages/admin/AdminNotifications'
import AdminExams from './pages/admin/AdminExams'
import AdminCurrentAffairs from './pages/admin/AdminCurrentAffairs'
import AdminPapers from './pages/admin/AdminPapers'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>
  return user ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/exams" element={<Exams />} />
      <Route path="/current-affairs" element={<CurrentAffairs />} />
      <Route path="/previous-papers" element={<PreviousPapers />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/genius-ai" element={<GeniusAI />} />
      <Route path="/daily-quiz" element={<DailyQuiz />} />
      <Route path="/mock-tests" element={<MockTests />} />
      <Route path="/job-alerts" element={<JobAlerts />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute><AdminNotifications /></ProtectedRoute>} />
      <Route path="/admin/exams" element={<ProtectedRoute><AdminExams /></ProtectedRoute>} />
      <Route path="/admin/current-affairs" element={<ProtectedRoute><AdminCurrentAffairs /></ProtectedRoute>} />
      <Route path="/admin/papers" element={<ProtectedRoute><AdminPapers /></ProtectedRoute>} />
    </Routes>
  )
}
