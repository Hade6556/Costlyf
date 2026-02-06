import { createContext, useContext, useState, useEffect } from 'react'
import { getToken, clearSession, fetchWithAuth } from '../lib/auth'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  return ctx || {
    getToken: () => getToken(),
    clearSession: () => clearSession(),
    fetchWithAuth,
    refreshAuth: () => Promise.resolve(),
    isLoggedIn: () => !!getToken(),
    user: null,
    profile: null,
    trustStats: null,
    loading: false,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [trustStats, setTrustStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshAuth = () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setProfile(null)
      setTrustStats(null)
      return Promise.resolve()
    }
    return fetchWithAuth('/api/auth/me', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          setUser(null)
          setProfile(null)
          setTrustStats(null)
          return
        }
        setUser(data.user || null)
        setProfile(data.profile || null)
        setTrustStats(data.trust_stats || null)
      })
      .catch(() => {
        setUser(null)
        setProfile(null)
        setTrustStats(null)
      })
  }

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    refreshAuth().finally(() => setLoading(false))
  }, [])

  const value = {
    getToken,
    clearSession,
    fetchWithAuth,
    refreshAuth,
    isLoggedIn: () => !!getToken(),
    user,
    profile,
    trustStats,
    setProfile,
    setTrustStats,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
