import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BookOpen, LayoutDashboard, Bell, FileText, Newspaper, FileArchive, Bot, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/drafts', icon: Bot, label: 'AI Drafts' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
  { to: '/admin/exams', icon: FileText, label: 'Exams' },
  { to: '/admin/current-affairs', icon: Newspaper, label: 'Current Affairs' },
  { to: '/admin/papers', icon: FileArchive, label: 'Previous Papers' },
]

export default function AdminLayout({ children }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-900 dark:bg-gray-900 text-white flex flex-col fixed h-full">
        <div className="p-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <BookOpen className="h-5 w-5 text-blue-300" />
            AP|TS Exam Hub
          </Link>
          <p className="text-xs text-blue-300 mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {adminLinks.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10'}`
              }>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-white/10 w-full transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
      {/* Main */}
      <div className="flex-1 ml-64">
        <div className="p-8">{children}</div>
      </div>
    </div>
  )
}
