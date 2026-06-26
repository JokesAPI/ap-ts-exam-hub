import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // ── Fix: track mount state to prevent memory leak ──────────────────────────
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    // ── Fix: handle getSession errors ─────────────────────────────────────────
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error('Session error:', error)
        if (!mountedRef.current) return
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        setLoading(false)
      })
      .catch(err => {
        console.error('Auth init error:', err)
        if (mountedRef.current) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Fix: error handling + memory leak guard ────────────────────────────────
  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        // PGRST116 = no rows found -- not an error, just new user
        if (error.code !== 'PGRST116') console.error('Profile fetch error:', error)
        return
      }
      if (mountedRef.current) setProfile(data)
    } catch (err) {
      console.error('fetchProfile failed:', err)
    }
  }

  const signIn = async (email, password) => {
    try {
      return await supabase.auth.signInWithPassword({ email, password })
    } catch (err) {
      return { error: err }
    }
  }

  const signUp = async (email, password, fullName) => {
    try {
      return await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      })
    } catch (err) {
      return { error: err }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setProfile(null)
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  // ── Fix: safe date comparison ──────────────────────────────────────────────
  const isPro = profile?.is_pro &&
    profile?.pro_expires_at &&
    !isNaN(new Date(profile.pro_expires_at)) &&
    new Date(profile.pro_expires_at) > new Date()

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isPro, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
