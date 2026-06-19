import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X, Sun, Moon, BookOpen, Sparkles } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const links = [
  { to: '/', label: 'Home' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/exams', label: 'Exams' },
  { to: '/current-affairs', label: 'Current Affairs' },
  { to: '/previous-papers', label: 'Papers' },
  { to: '/daily-quiz', label: 'Quiz' },
  { to: '/mock-tests', label: 'Mock Tests' },
  { to: '/job-alerts', label: 'Jobs' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { dark, toggle } = useTheme()

  return (
    <nav className="bg-primary-800 dark:bg-gray-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight flex-shrink-0">
            <BookOpen className="h-6 w-6 text-blue-300" />
            <span className="hidden sm:block">AP<span className="text-yellow-300">|</span>TS Exam Hub</span>
            <span className="sm:hidden text-sm">AP|TS Hub</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'}
                className={({ isActive }) =>
                  `px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
                }>
                {l.label}
              </NavLink>
            ))}
            <Link to="/genius-ai" className="ml-2 flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
              <Sparkles className="h-3.5 w-3.5" /> Genius AI
            </Link>
            <button onClick={toggle} className="ml-2 p-2 rounded-lg hover:bg-white/10 transition-colors">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          {/* Mobile */}
          <div className="flex lg:hidden items-center gap-2">
            <Link to="/genius-ai" className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 px-2 py-1.5 rounded-lg text-xs font-bold">
              <Sparkles className="h-3 w-3" /> AI
            </Link>
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-white/10">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => setOpen(!open)} className="p-2 rounded-lg hover:bg-white/10">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/10 px-4 py-3 grid grid-cols-2 gap-1">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white/20' : 'text-blue-100 hover:bg-white/10'}`
              }>
              {l.label}
            </NavLink>
          ))}
          <Link to="/genius-ai" onClick={() => setOpen(false)}
            className="col-span-2 flex items-center justify-center gap-2 bg-yellow-400 text-yellow-900 px-3 py-2 rounded-lg text-sm font-bold mt-1">
            <Sparkles className="h-4 w-4" /> Genius AI — Free!
          </Link>
        </div>
      )}
    </nav>
  )
}
