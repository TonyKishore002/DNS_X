import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { verifyGoogleAccountWithBackend } from '../services/authService'

const AuthContext = createContext(null)

const AUTH_STORAGE_KEY = 'dns_x_auth_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!saved) return null
      const parsed = JSON.parse(saved)
      // Automatically purge legacy mock profiles so zero fake data persists
      if (
        parsed.id === 'usr_g_98241' ||
        parsed.id === 'usr_g_alex' ||
        parsed.id === 'usr_g_sarah' ||
        parsed.email?.includes('networkops.io') ||
        parsed.email?.includes('security-noc.com')
      ) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        return null
      }
      return parsed
    } catch {
      return null
    }
  })

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState(null)

  // Listen to Supabase auth events if active session returns from Google OAuth
  useEffect(() => {
    if (!isSupabaseConfigured) return

    // Check existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const supaUser = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'NOC Operator',
          email: session.user.email,
          avatar: session.user.user_metadata?.avatar_url || null,
          role: 'NOC Lead Engineer',
          provider: 'google',
          authTime: new Date().toISOString(),
        }
        setUser(supaUser)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(supaUser))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const supaUser = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'NOC Operator',
          email: session.user.email,
          avatar: session.user.user_metadata?.avatar_url || null,
          role: 'NOC Lead Engineer',
          provider: 'google',
          authTime: new Date().toISOString(),
        }
        setUser(supaUser)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(supaUser))
        setIsAuthModalOpen(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Real Google Account Verification & Authentication (Requires real Gmail ID and password)
  const signInWithGoogle = async (googleEmail, password) => {
    setIsAuthenticating(true)
    setAuthError(null)

    try {
      if (!googleEmail || !googleEmail.trim()) {
        throw new Error('Gmail ID or Google account email is required. Input cannot be empty.')
      }

      if (!password || !password.trim()) {
        throw new Error('Password for your Google account is required.')
      }

      if (password.length < 8) {
        throw new Error('Google account passwords must be at least 8 characters long.')
      }

      const verifiedUser = await verifyGoogleAccountWithBackend(googleEmail, password)

      const authenticatedUser = {
        ...verifiedUser,
        authTime: new Date().toISOString(),
      }

      setUser(authenticatedUser)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser))
      setIsAuthModalOpen(false)
      return authenticatedUser
    } catch (err) {
      const message = err.message || 'Authentication failed'
      setAuthError(message)
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }

  const signOut = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => {})
      }
    } finally {
      setUser(null)
      localStorage.removeItem(AUTH_STORAGE_KEY)
      setIsAuthModalOpen(false)
    }
  }

  const openAuthModal = () => {
    setAuthError(null)
    setIsAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    if (!isAuthenticating) {
      setIsAuthModalOpen(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAuthModalOpen,
        isAuthenticating,
        authError,
        signInWithGoogle,
        signOut,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
