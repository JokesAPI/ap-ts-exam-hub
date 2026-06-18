import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
  }

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })

  const signUp = async (email, password, fullName) => {
    const result = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    return result
  }

  const signOut = () => supabase.auth.signOut()

  const isPro = profile?.is_pro && new Date(profile?.pro_expires_at) > new Date()

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isPro, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
