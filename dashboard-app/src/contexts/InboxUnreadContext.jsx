import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const POLL_INTERVAL_MS = 5000

const InboxUnreadContext = createContext({ unreadCount: 0, refreshUnreadCount: () => {} })

export function useInboxUnread() {
  const ctx = useContext(InboxUnreadContext)
  return ctx || { unreadCount: 0, refreshUnreadCount: () => {} }
}

export function InboxUnreadProvider({ children }) {
  const { user, fetchWithAuth } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    fetchWithAuth('/api/chat/unread-count', {})
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((data) => setUnreadCount(typeof data.count === 'number' ? data.count : 0))
      .catch(() => setUnreadCount(0))
  }, [user, fetchWithAuth])

  useEffect(() => {
    fetchCount()
    if (!user) return
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, fetchCount])

  const value = { unreadCount, refreshUnreadCount: fetchCount }

  return (
    <InboxUnreadContext.Provider value={value}>
      {children}
    </InboxUnreadContext.Provider>
  )
}
