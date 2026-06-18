import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { BookOpen, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Welcome back! 🎉')
    navigate('/dashboard')
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Enter your full name'); return }
    setLoading(true)
    const { error } = await signUp(email, password, fullName)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Account created! Check your email to verify. 📧')
    setTab('login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <Helmet><title>{tab === 'login' ? 'Login' : 'Register'} - AP TS Exam Hub</title></Helmet>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-xl text-primary-700 dark:text-primary-400">
            <BookOpen className="h-7 w-7" />
            AP | TS Exam Hub
          </Link>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {tab === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
          <button onClick={() => setTab('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'login' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>
            Login
          </button>
          <button onClick={() => setTab('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'register' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>
            Register
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" required className="input" placeholder="you@email.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required className="input pr-10"
                  placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full btn-primary justify-center py-2.5 disabled:opacity-60">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input required className="input" placeholder="Ravi Kumar"
                value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" required className="input" placeholder="you@email.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required className="input pr-10"
                  minLength={6} placeholder="Min 6 characters"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full btn-primary justify-center py-2.5 disabled:opacity-60">
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
            <p className="text-xs text-center text-gray-400">
              By registering you agree to our <Link to="/privacy-policy" className="text-primary-600 hover:underline">Privacy Policy</Link>
            </p>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
