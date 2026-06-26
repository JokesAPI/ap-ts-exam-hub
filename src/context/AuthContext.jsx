import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    // ── Fix #5: Only use onAuthStateChange — remove double fetch ──────────────
    // Do NOT call getSession separately — onAuthStateChange fires on load too
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mountedRef.current) return
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          await fetchProfile(currentUser.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // ── Fix: error handling + memory leak guard ───────────────────────────────
  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (!mountedRef.current) return
      if (error) {
        if (error.code !== 'PGRST116') console.error('Profile error:', error)
        return
      }
      setProfile(data)
    } catch (err) {
      console.error('fetchProfile error:', err)
    }
  }

  const signIn = async (email, password) => {
    try { return await supabase.auth.signInWithPassword({ email, password }) }
    catch (err) { return { error: err } }
  }

  const signUp = async (email, password, fullName) => {
    try {
      return await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      })
    } catch (err) { return { error: err } }
  }

  const signOut = async () => {
    try { await supabase.auth.signOut(); setProfile(null) }
    catch (err) { console.error('Sign out error:', err) }
  }

  // Safe isPro check
  const isPro = Boolean(
    profile?.is_pro &&
    profile?.pro_expires_at &&
    !isNaN(new Date(profile.pro_expires_at)) &&
    new Date(profile.pro_expires_at) > new Date()
  )

  // ── Fix #9: memoize context value to prevent unnecessary re-renders ────────
  const value = useMemo(() => ({
    user, profile, loading, isPro,
    signIn, signUp, signOut, fetchProfile
  }), [user, profile, loading, isPro])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
